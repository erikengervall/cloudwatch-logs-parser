export type CloudWatchLogsParserOptions = {
  source: string;
  destination: string;
  verbose: boolean;
  concurrency?: number;
};
