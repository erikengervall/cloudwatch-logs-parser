import fs from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';

import { CloudWatchLogsParserOptions } from './types';
import { jsonParseSafe } from './utils/json-parse-safe';
import { logger } from './utils/logger';
import {
  DEFAULT_CONCURRENCY,
  DESTINATION_LOG_STREAMS_FOLDER,
} from './utils/misc';

type Message = string;
type PayloadCount = number;

type Output = {
  count: number;
  message: Message;
  payloads: Record<string, PayloadCount>;
};

export async function aggregate(options: CloudWatchLogsParserOptions) {
  const limit = pLimit(options.concurrency ?? DEFAULT_CONCURRENCY);
  const logStreamFiles = await fs.promises.readdir(
    path.resolve(options.destination, DESTINATION_LOG_STREAMS_FOLDER),
  );
  /**
   * Used to map messages to their output.
   */
  const map: Record<Message, Output> = {};
  /**
   * Used to store the output.
   */
  const output: Output[] = [];

  let progress = 0;
  async function job(logStreamFile: string) {
    const logStreamFilePath = path.resolve(options.destination, logStreamFile);

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
      const datelessLine = line.replace(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
        '',
      );

      /**
       * @example {"level":"info","message":"Processing something","timestamp":"2012-12-12 12:12:12"}
       *          ^^^^^^^^^
       */
      if (datelessLine.startsWith('{"level":')) {
        const { timestamp, message, ...rest } = (jsonParseSafe(datelessLine) ??
          {}) as Record<string, unknown>;
        timestamp; // omit timestamp
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
          };
        }

        map[message].count += 1;
        const stringifiedRest = JSON.stringify(rest);
        map[message].payloads[stringifiedRest] =
          (map[message].payloads[stringifiedRest] ?? 0) + 1;
      } else if (
        /**
         * @example "debug: Some Axios error {\"axiosErrorData\":{\"data\":{\"error_status_code\":\"SomeError\",\"message\":\"Unexpected error\",\"source\":\"some_service\"},\"success\":false},\"label\":\"some/path\"}": 1,
         *           ^^^
         */
        datelessLine.startsWith('err') ||
        datelessLine.startsWith('war') ||
        datelessLine.startsWith('inf') ||
        datelessLine.startsWith('deb')
      ) {
        const [message, payload] = datelessLine.split('{');

        // initialize
        if (!map[message]) {
          map[message] = {
            count: 0,
            message,
            payloads: {},
          };
        }

        map[message].count += 1;
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

  output; // TODO:
  fs.writeFileSync(
    path.resolve(__dirname, 'cloudwatch-analyzer-data-mapon'),
    JSON.stringify(map, null, 2),
  );
}
