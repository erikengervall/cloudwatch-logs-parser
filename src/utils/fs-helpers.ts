import fs from 'node:fs';

export function isDirectory(path: string): boolean {
  return fs.existsSync(path) && fs.lstatSync(path).isDirectory();
}

export function isFile(path: string): boolean {
  return fs.existsSync(path) && fs.lstatSync(path).isFile();
}
