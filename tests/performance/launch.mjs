import { spawn } from 'node:child_process';
import electron from 'electron';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['tests/performance/run.cjs'], {
  stdio: 'inherit',
  windowsHide: true,
  env
});
const timeout = setTimeout(() => {
  child.kill();
  process.exitCode = 1;
  console.error('Rendering checks timed out');
}, 60_000);
child.on('error', (error) => {
  clearTimeout(timeout);
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  clearTimeout(timeout);
  process.exitCode = code ?? 1;
});
