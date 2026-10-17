import { networkInterfaces } from 'node:os';

// Prefers a private (RFC 1918) address, so a VPN or virtual adapter does not win. Null when there
// is no external IPv4 interface.
export function getLanIpv4(): string | null {
  let fallback: string | null = null;

  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) {
        continue;
      }
      if (isPrivateIpv4(address.address)) {
        return address.address;
      }
      fallback ??= address.address;
    }
  }

  return fallback;
}

function isPrivateIpv4(ip: string): boolean {
  return /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}
