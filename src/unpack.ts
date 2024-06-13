import { globSync } from 'glob';
import fs from 'node:fs';
import path from 'node:path';

import { CloudWatchLogsParserOptions } from './types';
import { isDirectory } from './utils/fs-helpers';
import { gunzipFile } from './utils/gunzip-file';
import { logger } from './utils/logger';

export async function unpack(options: CloudWatchLogsParserOptions) {
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

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filenameWithoutExtension = file
      .replace(/\.gz$/, '')
      .replace(/\//g, '_');
    filenameWithoutExtension;

    const destination = path.resolve(
      options.destination,
      filenameWithoutExtension,
    );
    await gunzipFile({ source: file, destination });
    logger.debug(`Unpacked file ${i + 1} of ${files.length}`);
  }
}
