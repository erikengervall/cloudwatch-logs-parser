import { globSync } from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';

import { CloudWatchLogsParserOptions } from './types';
import { isDirectory } from './utils/fs-helpers';
import { gunzipFile } from './utils/gunzip-file';
import { logger } from './utils/logger';
import { DEFAULT_CONCURRENCY, UNPACKED_LOGS_FOLDER_NAME } from './utils/misc';

export async function unpack(options: CloudWatchLogsParserOptions) {
  const limit = pLimit(options.concurrency ?? DEFAULT_CONCURRENCY);

  if (isDirectory(options.destination)) {
    fs.rmSync(options.destination, { recursive: true });
  }
  fs.mkdirSync(options.destination);
  fs.mkdirSync(path.resolve(options.destination, UNPACKED_LOGS_FOLDER_NAME));
  logger.debug('Output folder has been reset.', {
    destination: options.destination,
  });

  const globPattern = path.resolve(options.source, '**/*.gz');
  const files = globSync(globPattern);

  if (files.length === 0) {
    throw new Error(`No files found in ${options.source}.`);
  }

  let progress = 0;
  async function job(file: string): Promise<void> {
    const filenameWithoutExtension = file
      .replace(/\.gz$/, '')
      .replace(/\//g, '_');
    const destination = path.resolve(
      options.destination,
      UNPACKED_LOGS_FOLDER_NAME,
      filenameWithoutExtension,
    );
    await gunzipFile({ source: file, destination });
    progress += 1;
    logger.debug(`Unpacked file ${progress} of ${files.length}.`);
  }
  const input = files.map((file) => {
    return limit(() => job(file));
  });
  await Promise.all(input);
}
