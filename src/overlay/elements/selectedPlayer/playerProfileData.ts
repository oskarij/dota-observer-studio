export type RankMedal =
  | 'ancient'
  | 'archon'
  | 'crusader'
  | 'divine'
  | 'guardian'
  | 'herald'
  | 'immortal'
  | 'legend';

export function mmrToMedal(mmr: number | null): RankMedal | null {
  if (mmr === null) {
    return null;
  }

  if (mmr >= 5620) {
    return 'immortal';
  }

  if (mmr >= 4260) {
    return 'divine';
  }

  if (mmr >= 3850) {
    return 'ancient';
  }

  if (mmr >= 3080) {
    return 'legend';
  }

  if (mmr >= 2310) {
    return 'archon';
  }

  if (mmr >= 1540) {
    return 'crusader';
  }

  if (mmr >= 770) {
    return 'guardian';
  }

  return 'herald';
}

// OpenDota encodes rank as a two-digit rank_tier: the tens digit is the medal (1=Herald..8=Immortal)
// and the ones digit is the star count, which we don't surface. null = no public rank -> no medal.
export function rankTierToMedal(rankTier: number | null): RankMedal | null {
  if (rankTier === null) {
    return null;
  }

  switch (Math.floor(rankTier / 10)) {
    case 1:
      return 'herald';
    case 2:
      return 'guardian';
    case 3:
      return 'crusader';
    case 4:
      return 'archon';
    case 5:
      return 'legend';
    case 6:
      return 'ancient';
    case 7:
      return 'divine';
    case 8:
      return 'immortal';
    default:
      return null;
  }
}
