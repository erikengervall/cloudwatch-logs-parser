export function chunkArray<T>(array: T[], chunkSize: number) {
  const chunks = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export const DEFAULT_CONCURRENCY = 5;

export const UNPACKED_LOGS_FOLDER_NAME = 'unpacked';
