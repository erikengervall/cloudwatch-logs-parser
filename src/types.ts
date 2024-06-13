import { z } from 'zod';

export const CloudWatchLogsParserOptions = z.object({
  source: z.string(),
  destination: z.string(),
  verbose: z.boolean(),
  concurrency: z.number().optional(),
});
export type CloudWatchLogsParserOptions = z.infer<
  typeof CloudWatchLogsParserOptions
>;
