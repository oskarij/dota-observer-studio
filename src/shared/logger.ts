/* eslint-disable no-console -- this module is the single sanctioned console boundary. */

export type LogSink = (level: 'warn' | 'error', message: string, detail?: unknown) => void;

let sink: LogSink | null = null;

// The main process adds a log file; renderers and the overlay log to the console only.
export function setLogSink(next: LogSink | null): void {
  sink = next;
}

export function logWarning(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.warn(message);
  } else {
    console.warn(message, detail);
  }
  sink?.('warn', message, detail);
}

export function logError(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.error(message);
  } else {
    console.error(message, detail);
  }
  sink?.('error', message, detail);
}
