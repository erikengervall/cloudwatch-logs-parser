import { glob } from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';

import { CloudWatchLogsParserOptions } from './types';
import { isDirectory } from './utils/fs-helpers';
import { gunzipFile } from './utils/gunzip-file';
import { logger } from './utils/logger';
import {
  DEFAULT_CONCURRENCY,
  DESTINATION_LOG_STREAMS_FOLDER,
} from './utils/misc';

export async function unpack(options: CloudWatchLogsParserOptions) {
  const limit = pLimit(options.concurrency ?? DEFAULT_CONCURRENCY);

  if (isDirectory(options.destination)) {
    await fs.promises.rm(options.destination, { recursive: true });
  }
  await fs.promises.mkdir(options.destination);
  await fs.promises.mkdir(
    path.resolve(options.destination, DESTINATION_LOG_STREAMS_FOLDER),
  );
  logger.debug('Output folder has been reset.', {
    destination: options.destination,
  });

  const globPattern = path.resolve(options.source, '**/*.gz');
  const files = await glob(globPattern);

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
      DESTINATION_LOG_STREAMS_FOLDER,
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
