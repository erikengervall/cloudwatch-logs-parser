import { CloudWatchLogsParserOptions } from './types';
import { unpack } from './unpack';
import { logger } from './utils/logger';

export function cloudwatchLogsParser(options: CloudWatchLogsParserOptions): {
  unpack: () => Promise<void>;
} {
  if (options.verbose) {
    logger.level = 'debug';
  }

  return {
    unpack: () => unpack(options),
  };
}
