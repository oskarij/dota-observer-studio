import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const tests = readdirSync(new URL('../tests/', import.meta.url), { recursive: true })
  .filter((file) => file.endsWith('.test.ts'))
  .map((file) => `build/test/tests/${file.replace(/\.ts$/, '.js')}`)
  .sort();
if (tests.length === 0) throw new Error('No unit tests found.');
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
