import path from 'node:path';
import { z } from 'zod';

import { cloudwatchLogsParser } from '.';

const RunOpt = z.union([
  z.literal('all'),
  z.literal('unpack'),
  z.literal('aggregate'),
]);

const argv = process.argv;
const runOpt = RunOpt.parse(argv[2]);

const { unpack, aggregate } = cloudwatchLogsParser({
  verbose: true,
  source: path.resolve(__dirname, '../data-input'),
  destination: path.resolve(__dirname, '../data-output'),
});

async function main() {
  if (runOpt === 'all' || runOpt === 'unpack') {
    await unpack();
  }

  if (runOpt === 'all' || runOpt === 'aggregate') {
    await aggregate();
  }
}

main();
