import { CloudWatchLogsParserOptions } from './types';
import { unpack } from './unpack';
import { logger } from './utils/logger';

export function cloudwatchLogsParser(options: CloudWatchLogsParserOptions): {
  unpack: () => Promise<void>;
  aggregate: () => Promise<void>;
} {
  if (options.verbose) {
    logger.level = 'debug';
  }

  return {
    unpack: async () => await unpack(options),
    aggregate: async () => {},
  };
}
