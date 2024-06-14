import fs from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';
import { z } from 'zod';

import { CloudWatchLogsParserOptions } from './types';
import { jsonParseSafe } from './utils/json-parse-safe';
import { logger } from './utils/logger';
import {
  DESTINATION_LOG_STREAMS_FOLDER,
  getConcurrencyOption,
} from './utils/misc';

const Message = z.string();
type Message = z.infer<typeof Message>;

const PayloadCount = z.number();
type PayloadCount = z.infer<typeof PayloadCount>;

const LogLevel = z.enum(['debug', 'info', 'warn', 'error', 'unmapped']);
type LogLevel = z.infer<typeof LogLevel>;

const Output = z.object({
  count: z.number(),
  message: Message,
  payloads: z.record(PayloadCount),
  format: z.enum(['json', 'string']),
});
type Output = z.infer<typeof Output>;

const dateLen = '2012-12-12T12:12:12.123Z '.length;

export async function aggregate(options: CloudWatchLogsParserOptions) {
  const limit = pLimit(getConcurrencyOption(options));
  const logStreamFiles = await fs.promises.readdir(
    path.resolve(options.destination, DESTINATION_LOG_STREAMS_FOLDER),
  );
  logger.debug('Found log streams in destination folder.', {
    logStreamFilesLen: logStreamFiles.length,
  });
  /**
   * Used to map messages to their output.
   */
  const map: Record<LogLevel, Record<Message, Output>> = {
    debug: {},
    info: {},
    warn: {},
    error: {},
    unmapped: {},
  };

  let progress = 0;
  async function job(logStreamFile: string) {
    const logStreamFilePath = path.resolve(
      options.destination,
      DESTINATION_LOG_STREAMS_FOLDER,
      logStreamFile,
    );
    logger.debug(`Processing log stream file...`, { logStreamFilePath });

    const logStreamFileContent = await fs.promises.readFile(
      logStreamFilePath,
      'utf8',
    );
    const lines = logStreamFileContent.split('\n');
    for (const line of lines) {
      /**
       * @example 2012-12-12T12:12:12.123Z {"level":"info","message":"Processing something","timestamp":"2012-12-12 12:12:12"}
       *          ^^^^^^^^^^^^^^^^^^^^^^^^^
       */
      const datelessLine = line.startsWith('20')
        ? line.substring(dateLen)
        : line;
      // const datelessLine = line.replace(
      //   /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
      //   '',
      // );

      /**
       * @example {"level":"info","message":"Processing something","timestamp":"2012-12-12 12:12:12"}
       *          ^^^^^^^^^
       */
      if (datelessLine.startsWith('{"level":')) {
        const { timestamp, message, ...rest } = (jsonParseSafe(datelessLine) ??
          {}) as Record<string, unknown>;
        timestamp; // omit timestamp so that payloads aggregate
        if (typeof message !== 'string') {
          logger.warn('Message is not a string', {
            datelessLine,
            message,
            messageType: typeof message,
          });
          continue;
        }

        const parsedLevel = LogLevel.safeParse(rest.level);
        const level = parsedLevel.success ? parsedLevel.data : 'unmapped';

        // initialize
        if (!map[level][message]) {
          map[level][message] = {
            count: 0,
            message,
            payloads: {},
            format: 'json',
          };
        }

        map[level][message].count++;
        const stringifiedRest = JSON.stringify(rest);
        // payload count
        map[level][message].payloads[stringifiedRest] =
          (map[level][message].payloads[stringifiedRest] ?? 0) + 1;
      } else if (
        /**
         * @example "debug: Some Axios error {\"axiosErrorData\":{\"data\":{\"error_status_code\":\"SomeError\",\"message\":\"Unexpected error\",\"source\":\"some_service\"},\"success\":false},\"label\":\"some/path\"}": 1,
         *           ^^^
         */
        datelessLine.startsWith('error') ||
        datelessLine.startsWith('warn') ||
        datelessLine.startsWith('info') ||
        datelessLine.startsWith('debug')
      ) {
        const firstBracketIndex = datelessLine.indexOf('{');
        const message = datelessLine.substring(0, firstBracketIndex);
        const payload = datelessLine.substring(firstBracketIndex);

        const parsedLevel = LogLevel.safeParse(message.split(':')[0]);
        const level = parsedLevel.success ? parsedLevel.data : 'unmapped';

        // initialize
        if (!map[level][message]) {
          map[level][message] = {
            count: 0,
            message,
            payloads: {},
            format: 'string',
          };
        }

        map[level][message].count++;
        // payload count
        map[level][message].payloads[payload] =
          (map[level][message].payloads[payload] ?? 0) + 1;
      }
    }

    progress += 1;
    logger.debug(
      `Processed log stream file ${progress} of ${logStreamFiles.length}.`,
    );
  }

  const input = logStreamFiles.map((logStreamFile) => {
    return limit(() => job(logStreamFile));
  });
  await Promise.all(input);

  for (const level of Object.keys(map) as LogLevel[]) {
    if (level === 'debug' || level === 'unmapped') {
      continue;
    }
    const output = Object.values(map[level])
      .sort((a, b) => b.count - a.count)
      .map((item) => {
        return {
          ...item,
          payloads: Object.entries(item.payloads).map(([payload, count]) => {
            return {
              payload,
              count,
            };
          }),
        };
      });
    logger.debug(`Writing output file for level "${level}".`);
    fs.writeFileSync(
      path.resolve(options.destination, `ouput-${level}.json`),
      '[' + output.map((el) => JSON.stringify(el, null, 2)).join(',') + ']', // https://stackoverflow.com/a/69548872/4724146
      // JSON.stringify(output, null, 2),
    );
  }
}
