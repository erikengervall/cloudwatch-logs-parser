import { CloudWatchLogsParserOptions } from './types';
import { unpack } from './unpack';
import { logger } from './utils/logger';

export async function cloudwatchLogsParser(
  options: CloudWatchLogsParserOptions,
): Promise<void> {
  if (options.verbose) {
    logger.level = 'debug';
  }

  await unpack(options);
}
