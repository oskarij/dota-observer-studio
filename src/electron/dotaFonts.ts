import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { logWarning } from '../shared/logger.js';
import { resolveDotaCfgDir } from './gsiConfig.js';

// Radiance and Reaver are Valve's fonts, so the app does not ship them. The overlay loads this
// PC's installed copies from /media/dota-fonts/ (overlay/elements.css).
export async function copyDotaFonts(mediaRoot: string): Promise<void> {
  const cfgDir = await resolveDotaCfgDir();
  if (cfgDir === null) {
    logWarning('Dota 2 not found; the overlay uses the system font instead of Radiance and Reaver');
    return;
  }

  const source = join(cfgDir, '..', 'panorama', 'fonts');
  const target = join(mediaRoot, 'dota-fonts');
  await mkdir(target, { recursive: true });
  const files = (await readdir(source)).filter((file) =>
    /^(radiance|reaver)-[a-z]+\.otf$/.test(file)
  );
  await Promise.all(files.map((file) => copyFile(join(source, file), join(target, file))));
}
