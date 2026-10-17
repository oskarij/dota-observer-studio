/* eslint camelcase: ["error", { "properties": "never" }] -- Steam protocol field names. */
import type { LeagueInfo, LeagueMatch } from '../shared/leagueSeries.js';
import { positiveId } from '../shared/matchContext.js';
import { isRecord } from '../shared/validation.js';

export const NO_KEY_REASON = 'Add a Steam Web API key in Settings to load earlier games.';

export type LeagueFetchResult =
  | { outcome: 'resolved'; league: LeagueInfo }
  | { outcome: 'not-found' }
  | { outcome: 'transient' };

export type MatchInfoFetchResult =
  | { outcome: 'resolved'; heroIds: number[] }
  | { outcome: 'not-found' }
  | { outcome: 'transient' }
  | { outcome: 'no-key' };

export interface LeagueMatchesOptions {
  seriesId: number;
  includeResults: boolean;
  excludeMatchId: string | null;
  expectedGames?: number;
}

export type LeagueMatchesFetchResult =
  | { outcome: 'resolved'; matches: LeagueMatch[]; pending?: boolean }
  | { outcome: 'not-found' }
  | { outcome: 'transient' }
  | { outcome: 'no-key' };

interface SteamMatch {
  match_id?: number;
  match_seq_num?: number;
  start_time?: number;
  leagueid?: number;
  series_id?: number;
  series_type?: number;
  radiant_team_id?: number;
  dire_team_id?: number;
  radiant_win?: boolean;
  players?: { hero_id?: number; player_slot?: number }[];
}

interface SteamResult {
  status?: number;
  matches?: SteamMatch[];
  results_remaining?: number;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

// All requests run in main. Header authentication keeps credentials out of URLs and logs. Steam's
// history endpoints need the operator's own key; without one they resolve as unavailable.
export function createValveClient(request: typeof fetch, apiKey: () => string | null) {
  const matchesById = new Map<string, LeagueMatch>();
  const inFlight = new Map<string, Promise<SteamResult | null>>();
  let retryAfter = 0;

  function steam(
    method: string,
    params: Record<string, string | number>
  ): Promise<SteamResult | null> {
    const url = new URL(`https://api.steampowered.com/IDOTA2Match_570/${method}/v1/`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    const key = apiKey();
    if (key === null) return Promise.resolve(null);
    const existing = inFlight.get(url.href);
    if (existing) return existing;
    const pending = (async (): Promise<SteamResult | null> => {
      if (Date.now() < retryAfter) return null;
      try {
        const response = await request(url.href, {
          headers: { 'x-webapi-key': key },
          signal: AbortSignal.timeout(15_000),
          redirect: 'error'
        });
        if (!response.ok) {
          if (response.status === 429) {
            const seconds = Number(response.headers.get('retry-after'));
            retryAfter = Date.now() + Math.max(60, Number.isFinite(seconds) ? seconds : 60) * 1000;
          }
          return null;
        }
        const body = (await response.json()) as { result?: SteamResult } | null;
        const result = body?.result;
        if (result?.status !== 1 || !Array.isArray(result.matches)) return null;
        return { ...result, matches: result.matches.filter(isRecord) };
      } catch {
        // Never log request objects or credentials, including on network failures.
        return null;
      }
    })();
    inFlight.set(url.href, pending);
    void pending.finally(() => inFlight.delete(url.href));
    return pending;
  }

  function remember(entry: SteamMatch): LeagueMatch | null {
    if (!Number.isSafeInteger(entry.match_id) || (entry.match_id ?? 0) <= 0) return null;
    const matchId = String(entry.match_id);
    const previous = matchesById.get(matchId);
    const players = Array.isArray(entry.players) ? entry.players : [];
    const picked = players
      .filter(
        (player) =>
          isRecord(player) &&
          typeof player.hero_id === 'number' &&
          Number.isSafeInteger(player.hero_id) &&
          player.hero_id > 0 &&
          typeof player.player_slot === 'number' &&
          Number.isSafeInteger(player.player_slot) &&
          player.player_slot >= 0 &&
          (player.player_slot < 5 || (player.player_slot >= 128 && player.player_slot < 133))
      )
      .sort((a, b) => (a.player_slot ?? 0) - (b.player_slot ?? 0));
    const complete =
      picked.length === 10 &&
      new Set(picked.map((p) => p.player_slot)).size === 10 &&
      new Set(picked.map((p) => p.hero_id)).size === 10;
    const sequence =
      positiveId(entry.match_seq_num) === null
        ? previous?.matchSequence
        : String(entry.match_seq_num);
    const match: LeagueMatch = {
      matchId,
      startTime: positiveId(entry.start_time) ?? previous?.startTime ?? 0,
      radiantTeamId: positiveId(entry.radiant_team_id) ?? previous?.radiantTeamId ?? null,
      direTeamId: positiveId(entry.dire_team_id) ?? previous?.direTeamId ?? null,
      radiantWin:
        typeof entry.radiant_win === 'boolean' ? entry.radiant_win : (previous?.radiantWin ?? null),
      seriesId: positiveId(entry.series_id) ?? previous?.seriesId ?? null,
      seriesType:
        typeof entry.series_type === 'number' &&
        Number.isSafeInteger(entry.series_type) &&
        entry.series_type >= 0
          ? entry.series_type
          : (previous?.seriesType ?? null),
      ...(sequence === undefined ? {} : { matchSequence: sequence }),
      heroIds: complete ? picked.map((p) => p.hero_id as number) : (previous?.heroIds ?? [])
    };
    matchesById.set(matchId, match);
    return match;
  }

  async function fetchLeague(leagueId: number): Promise<LeagueFetchResult> {
    try {
      const response = await request(
        `https://www.dota2.com/webapi/IDOTA2League/GetLeagueData/v001?league_id=${encodeURIComponent(leagueId)}`,
        { signal: AbortSignal.timeout(15_000), redirect: 'error' }
      );
      if (!response.ok) return { outcome: 'transient' };
      const body = (await response.json()) as {
        info?: { league_id?: number; name?: string };
      } | null;
      if (body?.info?.league_id !== leagueId) return { outcome: 'not-found' };
      return {
        outcome: 'resolved',
        league: { leagueId, name: body.info.name ?? `League ${leagueId}` }
      };
    } catch {
      return { outcome: 'transient' };
    }
  }

  async function fetchLeagueMatches(
    leagueId: number,
    options: LeagueMatchesOptions
  ): Promise<LeagueMatchesFetchResult> {
    if (apiKey() === null) return { outcome: 'no-key' };
    const found = new Map<string, LeagueMatch>();
    let cursor: string | null = null;
    let pending = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await steam('GetMatchHistory', {
        league_id: leagueId,
        matches_requested: PAGE_SIZE,
        ...(cursor === null ? {} : { start_at_match_id: cursor })
      });
      if (!result || !Array.isArray(result.matches)) return { outcome: 'transient' };
      for (const entry of result.matches) {
        const match = remember(entry);
        if (match?.seriesId === options.seriesId) found.set(match.matchId, match);
      }
      const priorCount = [...found.values()].filter(
        (match) =>
          options.excludeMatchId === null || BigInt(match.matchId) < BigInt(options.excludeMatchId)
      ).length;
      if (options.expectedGames !== undefined && priorCount >= options.expectedGames) break;
      if (result.matches.length < PAGE_SIZE || result.results_remaining === 0) break;
      const ids = result.matches
        .map((m) => m.match_id)
        .filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0);
      if (ids.length === 0) return { outcome: 'transient' };
      const next = String(Math.min(...ids) - 1);
      if (cursor !== null && BigInt(next) >= BigInt(cursor)) return { outcome: 'transient' };
      cursor = next;
      pending = page === MAX_PAGES - 1;
    }
    const matches: LeagueMatch[] = [];
    for (let match of found.values()) {
      const beforeCurrent =
        options.excludeMatchId === null || BigInt(match.matchId) < BigInt(options.excludeMatchId);
      if (options.includeResults && beforeCurrent && match.radiantWin === null) {
        if (match.matchSequence !== undefined) {
          const result = await steam('GetMatchHistoryBySequenceNum', {
            start_at_match_seq_num: match.matchSequence,
            matches_requested: 1
          });
          // Sequence requests are global: never accept a neighbouring match or another league.
          const entry = result?.matches?.find(
            (m) =>
              String(m.match_id) === match.matchId &&
              String(m.match_seq_num) === match.matchSequence &&
              m.leagueid === leagueId &&
              typeof m.radiant_win === 'boolean'
          );
          if (entry) match = remember(entry) ?? match;
        }
        if (match.radiantWin === null) pending = true;
      }
      if (beforeCurrent && (match.heroIds?.length ?? 0) !== 10) pending = true;
      matches.push(match);
    }
    return { outcome: 'resolved', matches, pending };
  }

  async function fetchMatchInfo(matchId: string, leagueId?: number): Promise<MatchInfoFetchResult> {
    if (!/^[1-9]\d*$/.test(matchId)) return { outcome: 'not-found' };
    let match = matchesById.get(matchId);
    if (match?.heroIds?.length !== 10) {
      if (apiKey() === null) return { outcome: 'no-key' };
      const result = await steam('GetMatchHistory', {
        start_at_match_id: matchId,
        matches_requested: 1,
        ...(leagueId === undefined ? {} : { league_id: leagueId })
      });
      if (!result || !Array.isArray(result.matches)) return { outcome: 'transient' };
      const entry = result.matches.find((m) => String(m.match_id) === matchId);
      if (!entry) return { outcome: 'not-found' };
      match = remember(entry) ?? undefined;
    }
    if (match?.heroIds?.length !== 10) return { outcome: 'not-found' };
    return { outcome: 'resolved', heroIds: match.heroIds };
  }

  return { fetchLeague, fetchLeagueMatches, fetchMatchInfo };
}

export type ValveClient = ReturnType<typeof createValveClient>;
