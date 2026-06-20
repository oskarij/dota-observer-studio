// Steam32 account ids are numeric. Shared so the known-players editor, the CSV importer, and the
// rank-fetch path reject the same way and cannot drift.
export function isValidAccountId(accountId: string): boolean {
  return /^[0-9]+$/u.test(accountId.trim());
}
