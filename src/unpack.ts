import { globSync } from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';

import { CloudWatchLogsParserOptions } from './types';
import { isDirectory } from './utils/fs-helpers';
import { gunzipFile } from './utils/gunzip-file';
import { logger } from './utils/logger';

export async function unpack(options: CloudWatchLogsParserOptions) {
  const limit = pLimit(options.concurrency ?? 1);

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

  // const concurrency = options.concurrency ?? 10;
  // const jobChunks = chunkArray(
  //   files.map((file) => {
  //     return () => job(file);
  //   }),
  //   concurrency,
  // );

  const input = files.map((file) => {
    return limit(() => job(file));
  });
  await Promise.all(input);

  // for (const jobChunk of jobChunks) {
  //   const result = await Promise.all(jobChunk.map((job) => job()));
  //   logger.debug('Job result', { result });
  // }

  // logger.debug('chunks', {
  //   chunks: JSON.stringify(chunks, null, 2),
  // });
  // split files into chunks
  // const chunks = chunkArray(files, concurrency);

  // for (const chunk of chunks) {
  //   const jobs = chunk.map((file) => job(file));
  //   await Promise.all(jobs);
  // }

  // const jobChunks = [];
  // for (let i = 0; i < files.length; i++) {

  // }
}
