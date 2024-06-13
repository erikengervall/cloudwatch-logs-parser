import fs from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';

import { CloudWatchLogsParserOptions } from './types';
import { jsonParseSafe } from './utils/json-parse-safe';
import { logger } from './utils/logger';
import {
  DESTINATION_LOG_STREAMS_FOLDER,
  getConcurrencyOption,
} from './utils/misc';

type Message = string;
type PayloadCount = number;

type Output = {
  count: number;
  message: Message;
  payloads: Record<string, PayloadCount>;
  format: 'json' | 'string';
};

const dateLen = '2012-12-12T12:12:12.123Z '.length;

export async function aggregate(options: CloudWatchLogsParserOptions) {
  const limit = pLimit(getConcurrencyOption(options));
  const logStreamFiles = (
    await fs.promises.readdir(
      path.resolve(options.destination, DESTINATION_LOG_STREAMS_FOLDER),
    )
  ).slice(0, 2);
  logger.debug('Found log streams in destination folder.', {
    logStreamFilesLen: logStreamFiles.length,
  });
  /**
   * Used to map messages to their output.
   */
  const map: Record<Message, Output> = {};

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

        // initialize
        if (!map[message]) {
          map[message] = {
            count: 0,
            message,
            payloads: {},
            format: 'json',
          };
        }

        map[message].count++;
        const stringifiedRest = JSON.stringify(rest);
        // payload count
        map[message].payloads[stringifiedRest] =
          (map[message].payloads[stringifiedRest] ?? 0) + 1;
      } else if (
        /**
         * @example "debug: Some Axios error {\"axiosErrorData\":{\"data\":{\"error_status_code\":\"SomeError\",\"message\":\"Unexpected error\",\"source\":\"some_service\"},\"success\":false},\"label\":\"some/path\"}": 1,
         *           ^^^
         */
        datelessLine.startsWith('error:') ||
        datelessLine.startsWith('warn:') ||
        datelessLine.startsWith('info:') ||
        datelessLine.startsWith('debug:')
      ) {
        const [message, payload] = datelessLine.split('{');

        // initialize
        if (!map[message]) {
          map[message] = {
            count: 0,
            message,
            payloads: {},
            format: 'string',
          };
        }

        map[message].count++;
        // payload count
        map[message].payloads[payload] =
          (map[message].payloads[payload] ?? 0) + 1;
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

  fs.writeFileSync(
    path.resolve(options.destination, 'aggregated-data-obj.json'),
    JSON.stringify(map, null, 2),
  );

  /**
   * Used to store the output.
   */
  const output: Output[] = Object.values(map);
  output.sort((a, b) => b.count - a.count);
  fs.writeFileSync(
    path.resolve(options.destination, 'aggregated-data-arr.json'),
    JSON.stringify(output, null, 2),
  );
}
