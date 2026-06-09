/* eslint-disable no-console -- this module is the single sanctioned console boundary. */

export function logWarning(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.warn(message);
    return;
  }

  console.warn(message, detail);
}

export function logError(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.error(message);
    return;
  }

  console.error(message, detail);
}
