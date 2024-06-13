import { globSync } from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';

import { CloudWatchLogsParserOptions } from './types';
import { isDirectory } from './utils/fs-helpers';
import { gunzipFile } from './utils/gunzip-file';
import { logger } from './utils/logger';
import { DEFAULT_CONCURRENCY } from './utils/misc';

export async function unpack(options: CloudWatchLogsParserOptions) {
  const limit = pLimit(options.concurrency ?? DEFAULT_CONCURRENCY);

  if (isDirectory(options.destination)) {
    fs.rmSync(options.destination, { recursive: true });
  }
  fs.mkdirSync(options.destination);
  logger.debug('Reset output folder', { destination: options.destination });

  const globPattern = path.resolve(options.source, '**/*.gz');
  const files = globSync(globPattern);

  if (files.length === 0) {
    logger.debug('No files found');
    return;
  }

  async function job(file: string): Promise<void> {
    const filenameWithoutExtension = file
      .replace(/\.gz$/, '')
      .replace(/\//g, '_');
    const destination = path.resolve(
      options.destination,
      filenameWithoutExtension,
    );
    await gunzipFile({ source: file, destination });
    logger.debug('Unpacked file');
  }

  const input = files.map((file) => {
    return limit(() => job(file));
  });
  await Promise.all(input);
}
