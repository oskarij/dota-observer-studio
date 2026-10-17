import { execFile } from 'node:child_process';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';

// Run with an installed ffmpeg or pass its executable path as the first argument.
// The committed WebP frames are runtime assets; packaging never needs ffmpeg.
const ffmpeg = process.argv[2] ?? 'ffmpeg';
const run = promisify(execFile);
const source = resolve('src/overlay/elements/draftScreen/heroVideos');
const destination = resolve('src/overlay/elements/draftScreen/heroPosters');
await mkdir(destination, { recursive: true });
const videos = (await readdir(source)).filter((file) => file.endsWith('.webm')).sort();
let bytes = 0;
for (const [index, file] of videos.entries()) {
  const output = join(destination, file.replace(/\.webm$/, '.webp'));
  await run(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-ss',
      '1',
      '-i',
      join(source, file),
      '-frames:v',
      '1',
      '-an',
      '-c:v',
      'libwebp',
      '-quality',
      '85',
      output
    ],
    { windowsHide: true }
  );
  bytes += (await stat(output)).size;
  if ((index + 1) % 32 === 0) console.log(`Extracted ${index + 1}/${videos.length} portraits`);
}
console.log(`${videos.length} still portraits, ${Math.round(bytes / 1024)} KiB total`);
