export type Result<T extends object = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; reason: string };

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed.';
}
