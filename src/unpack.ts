import { globSync } from 'glob';
import fs from 'node:fs';
import path from 'node:path';

import PQueue from 'p-queue';
import { CloudWatchLogsParserOptions } from './types.ts';
import { isDirectory } from './utils/fs-helpers.ts';
import { gunzipFile } from './utils/gunzip-file.ts';
import { logger } from './utils/logger.ts';

export async function unpack(options: CloudWatchLogsParserOptions) {
  const queue = new PQueue({
    concurrency: options.concurrency ?? 3,
  });
  queue.on('completed', (result) => {
    logger.debug('Unpacked file', { result });
  });
  // const limit = pLimit(2);

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

  async function job(file: string) {
    const filenameWithoutExtension = file
      .replace(/\.gz$/, '')
      .replace(/\//g, '_');
    filenameWithoutExtension;

    const destination = path.resolve(
      options.destination,
      filenameWithoutExtension,
    );
    await gunzipFile({ source: file, destination });
    return {
      file,
    };
  }

  // const input = [];
  for (let i = 0; i < files.length; i++) {
    await queue.add(async () => await job(files[i]));
    // input.push(limit(async () => await job(files[i])));
  }

  // const result = await Promise.all(input);
  // logger.debug('Unpacked files', { result });

  await queue.onEmpty();
}
