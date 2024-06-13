import fs from 'node:fs';
import path from 'node:path';

import { CloudWatchLogsParserOptions } from './types';
import { jsonParseSafe } from './utils/json-parse-safe';
import { logger } from './utils/logger';

const map: Record<
  string,
  {
    count: number;
    payloads: Record<string, number>;
  }
> = {};

export async function aggregate(options: CloudWatchLogsParserOptions) {
  const logStreamFiles = fs.readdirSync(options.destination);

  for (let i = 0; i < logStreamFiles.length; i++) {
    const logStreamFile = logStreamFiles[i];
    const logStreamFilePath = path.resolve(options.destination, logStreamFile);

    const logStreamFileContent = fs.readFileSync(logStreamFilePath, 'utf8');
    const lines = logStreamFileContent.split('\n');
    for (const line of lines) {
      // 2012-12-12T12:12:12.123Z {"level":"info","message":"Processing something","timestamp":"2012-12-12 12:12:12"}
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
            payloads: {},
          };
        }

        map[message].count += 1;
        const stringifiedRest = JSON.stringify(rest);
        map[message].payloads[stringifiedRest] =
          (map[message].payloads[stringifiedRest] ?? 0) + 1;
        continue;
      }

      /**
       * @example "debug: Some Axios error {\"axiosErrorData\":{\"data\":{\"error_status_code\":\"SomeError\",\"message\":\"Unexpected error\",\"source\":\"some_service\"},\"success\":false},\"label\":\"some/path\"}": 1,
       *           ^^^
       */
      if (
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
            payloads: {},
          };
        }

        map[message].count += 1;
        map[message].payloads[payload] =
          (map[message].payloads[payload] ?? 0) + 1;
        continue;
      }
    }

    logger.debug(`Processed file ${i + 1} / ${logStreamFiles.length}`);
  }

  fs.writeFileSync(
    path.resolve(__dirname, 'cloudwatch-analyzer-data-mapon'),
    JSON.stringify(map, null, 2),
  );
}
