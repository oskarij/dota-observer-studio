import type { PlayerNameSource } from '../../../shared/componentOptions.js';
import type { DotaGsiData, DotaGsiTeamKey } from '../../../shared/dotaGsiPayload.js';
import type { KnownPlayer } from '../../../shared/knownPlayer.js';

// Read the live lineup even before heroes are picked. Player keys can arrive out of order;
// their numeric slot keeps the list stable across payloads and saved-name changes.
export function getTeamPlayerNames(
  gsiData: DotaGsiData,
  teamKey: DotaGsiTeamKey,
  source: PlayerNameSource,
  knownPlayers: ReadonlyMap<string, KnownPlayer>
): string[] {
  return Object.entries(gsiData.player?.[teamKey] ?? {})
    .filter(([key, player]) => /^player\d+$/.test(key) && player !== undefined)
    .sort(([a], [b]) => Number(a.slice(6)) - Number(b.slice(6)))
    .slice(0, 5)
    .map(([, player]) => {
      const profile =
        source === 'profile' && player?.accountid !== undefined
          ? knownPlayers.get(player.accountid)
          : undefined;
      return profile?.name.trim() || player?.name?.trim() || '';
    });
}
