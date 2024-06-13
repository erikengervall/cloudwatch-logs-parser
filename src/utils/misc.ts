import { CloudWatchLogsParserOptions } from '../types';

export function chunkArray<T>(array: T[], chunkSize: number) {
  const chunks = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export const DESTINATION_LOG_STREAMS_FOLDER = 'log-streams';
export const DEFAULT_CONCURRENCY = 10;

export function getConcurrencyOption(options: CloudWatchLogsParserOptions) {
  return options.concurrency ?? DEFAULT_CONCURRENCY;
}
