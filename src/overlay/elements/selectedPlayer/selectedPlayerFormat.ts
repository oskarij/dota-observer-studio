import type { RankMedal } from './playerProfileData.js';

export function formatMmr(mmr: number | null): string {
  if (mmr === null) {
    return '--';
  }

  if (mmr < 1000) {
    return String(mmr);
  }

  const truncatedTenths = Math.trunc(mmr / 100);
  const thousands = Math.trunc(truncatedTenths / 10);
  const tenths = truncatedTenths % 10;

  return tenths === 0 ? `${thousands}k` : `${thousands}.${tenths}k`;
}

export function formatMedalName(medal: RankMedal): string {
  return medal.charAt(0).toUpperCase() + medal.slice(1);
}
