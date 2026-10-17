import { createServer } from 'node:http';

// Resolves if the port is free, rejects if it is taken.
export async function probePort(host: string, port: number): Promise<void> {
  const probe = createServer();

  try {
    await new Promise<void>((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(port, host, resolve);
    });
  } finally {
    await new Promise<void>((resolve) => {
      probe.close(() => {
        resolve();
      });
    });
  }
}
