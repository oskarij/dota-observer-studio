export function isValidAccountId(accountId: string): boolean {
  return /^[0-9]+$/u.test(accountId.trim());
}
