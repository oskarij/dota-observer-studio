import type { DotaGsiData, DotaGsiHeroTeam, DotaGsiPlayerTeam } from './dotaGsiPayload.js';

// The renderers use identity/selection, draft state, and phase; health, mana, economy, provider
// timestamps, and Valve's previously/added blocks never affect this overlay. Keep the original
// payload in the main process for capture/services and send only this view over SSE.
export function projectOverlayPayload(data: DotaGsiData): DotaGsiData {
  const hero: NonNullable<DotaGsiData['hero']> = {};
  const player: NonNullable<DotaGsiData['player']> = {};
  for (const side of ['team2', 'team3'] as const) {
    const heroes: DotaGsiHeroTeam = {};
    for (const key of Object.keys(data.hero?.[side] ?? {}).sort()) {
      const slot = key as keyof DotaGsiHeroTeam;
      const entry = data.hero?.[side]?.[slot];
      if (entry?.selected_unit === true) heroes[slot] = { selected_unit: true };
    }
    if (Object.keys(heroes).length > 0) hero[side] = heroes;

    const players: DotaGsiPlayerTeam = {};
    for (const key of Object.keys(data.player?.[side] ?? {}).sort()) {
      const slot = key as keyof DotaGsiPlayerTeam;
      const entry = data.player?.[side]?.[slot];
      if (entry !== undefined) {
        players[slot] = {
          ...(entry.accountid !== undefined ? { accountid: entry.accountid } : {}),
          ...(entry.name !== undefined ? { name: entry.name } : {})
        };
      }
    }
    if (Object.keys(players).length > 0) player[side] = players;
  }
  const map = data.map;
  return {
    ...(map !== undefined
      ? {
          map: {
            ...(map.game_state !== undefined ? { game_state: map.game_state } : {}),
            ...(map.game_mode !== undefined ? { game_mode: map.game_mode } : {}),
            ...(map.matchid !== undefined ? { matchid: map.matchid } : {}),
            ...(map.paused !== undefined ? { paused: map.paused } : {})
          }
        }
      : {}),
    ...(data.draft !== undefined ? { draft: data.draft } : {}),
    hero,
    player
  };
}
