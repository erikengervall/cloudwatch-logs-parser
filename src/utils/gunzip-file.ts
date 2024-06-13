import fs from 'node:fs';
import zlib from 'node:zlib';

export async function gunzipFile(args: {
  source: string;
  destination: string;
}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const source = fs.createReadStream(args.source);
    const destination = fs.createWriteStream(args.destination);
    source.pipe(zlib.createGunzip()).pipe(destination);
    destination.on('close', () => resolve());
    destination.on('error', (error) => reject(error));
  });
}
