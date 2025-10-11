import type { Config } from 'tailwindcss'
import * as fs from 'node:fs';
import * as path from 'node:path';

function getDirectoryDirs(dirPath: string): string[] {
  const dirs = [];
  const data = fs.readdirSync(path.join(__dirname, dirPath));
  for (const dir of data) {
    if (fs.statSync(path.join(__dirname, dirPath, dir)).isDirectory()) {
      dirs.push(path.join(dirPath, dir))
      dirs.push(...getDirectoryDirs(path.join(dirPath, dir)));
    }
  }
  return dirs;
}

const dirs = getDirectoryDirs('./')

export default {
  content: [
    './*.{js,jsx,ts,tsx}',
    ...dirs.map(dir => `${dir}/*.{js,jsx,ts,tsx}`)
  ],
  theme: {
    extend: {},
  },
} satisfies Config
