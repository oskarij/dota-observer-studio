import type { OverlayConfig } from './componentSettings.js';
import type { FearlessSeriesState, FearlessCommand, WatchedGame } from './fearlessDraft.js';
import type { KnownPlayer } from './knownPlayer.js';
import type { TournamentState } from './leagueSeries.js';
import type { NetworkInfo, NetworkSettings } from './networkConfig.js';
import type { SeriesSnapshot, Side } from './seriesState.js';
import type { Team } from './team.js';

import type { Result } from './result.js';
import type { RosterSnapshot, TeamPatch, PlayerPatch } from './roster.js';

// The key itself never leaves main; the studio only learns whether one is saved.
export type TournamentView = TournamentState & { readonly hasApiKey: boolean };

export interface StudioApi {
  platform: string;
  settings: {
    get(): Promise<OverlayConfig>;
    set(config: OverlayConfig): Promise<Result>;
    export(): Promise<Result<{ path: string }>>;
    import(): Promise<Result<{ config: OverlayConfig }>>;
    openMediaFolder(): Promise<Result>;
    openLogsFolder(): Promise<Result>;
  };
  network: {
    get(): Promise<NetworkInfo>;
    set(settings: NetworkSettings): Promise<Result>;
  };
  gsi: {
    install(): Promise<Result<{ path: string }>>;
    export(): Promise<Result<{ path: string }>>;
  };
  playerRanks: {
    clear(): Promise<void>;
  };
  fonts: {
    list(): Promise<string[]>;
  };
  knownPlayers: {
    get(): Promise<RosterSnapshot<KnownPlayer>>;
    set(players: KnownPlayer[]): Promise<Result>;
    add(player: KnownPlayer): Promise<Result>;
    update(id: string, patch: PlayerPatch): Promise<Result>;
    remove(id: string): Promise<Result>;
    onChanged(handler: () => void): () => void;
    exportCsv(csv: string): Promise<Result<{ path: string }>>;
    importCsv(): Promise<Result<{ text: string }>>;
  };
  teams: {
    get(): Promise<RosterSnapshot<Team>>;
    add(team: Team): Promise<Result>;
    update(id: string, patch: TeamPatch): Promise<Result>;
    remove(id: string): Promise<Result>;
    pickLogo(id: string): Promise<Result>;
    onChanged(handler: () => void): () => void;
  };
  series: {
    get(): Promise<SeriesSnapshot>;
    setTeam(side: Side, teamId: string | null): Promise<Result>;
    swapSides(): Promise<Result>;
    adjustScore(side: Side, delta: number): Promise<Result>;
    useAutomaticScore(): Promise<Result>;
    resetScores(): Promise<Result>;
    onChanged(handler: () => void): () => void;
  };
  tournament: {
    get(): Promise<TournamentView>;
    refresh(): Promise<Result>;
    setApiKey(key: string | null): Promise<Result>;
    onChanged(handler: () => void): () => void;
  };
  fearless: {
    getWatchedGames(): Promise<WatchedGame[]>;
    onWatchedGamesChanged(handler: () => void): () => void;
    getSeries(): Promise<FearlessSeriesState>;
    editSeries(
      command: FearlessCommand,
      revision: number
    ): Promise<Result<{ state: FearlessSeriesState }>>;
    onSeriesChanged(handler: () => void): () => void;
    fetchMatch(matchId: string): Promise<Result<{ game: WatchedGame }>>;
  };
  app: {
    setDirty(dirty: boolean): void;
    onSaveAndQuit(handler: () => void): () => void;
    confirmQuit(): void;
  };
}
