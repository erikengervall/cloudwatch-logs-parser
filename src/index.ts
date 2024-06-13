import { CloudWatchLogsParserOptions } from "./types.ts";
import { unpack } from "./unpack.ts";
import { logger } from "./utils/logger.ts";

export async function cloudwatchLogsParser(
  options: CloudWatchLogsParserOptions,
): Promise<void> {
  if (options.verbose) {
    logger.level = 'debug';
  }

  await unpack(options);
}
