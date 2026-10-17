import type { DotaGsiData } from '../../../shared/dotaGsiPayload.js';

// Ignore whole-second rounding and ordinary GSI buffering when they agree with the local clock.
const TIMER_RESYNC_TOLERANCE_MS = 1200;

export interface TimerSync {
  turnKey: string;
  deadline: number;
  radiantReserve: number;
  direReserve: number;
  reserveSampledAt: number;
  activeteam: number | null;
  isPick: boolean;
  pausedAt: number | null;
}

export interface DraftTimerFigures {
  remaining: string;
  radiant: string;
  dire: string;
}

// The board supplies performance.now(); tests can advance the same clock without real-time waits.
export function syncDraftTimers(
  previous: TimerSync | null,
  gsiData: DotaGsiData,
  realNow: number
): TimerSync {
  const activeteam = gsiData.draft?.activeteam ?? null;
  const isPick = gsiData.draft?.pick === true;
  const paused = gsiData.map?.paused === true;
  const current = applyPauseState(previous, paused, realNow);
  const turnKey = getTurnKey(gsiData);

  const now = current?.pausedAt ?? realNow;
  const feedRemainingMs = (gsiData.draft?.activeteam_time_remaining ?? 0) * 1000;
  const radiantReserve = gsiData.draft?.radiant_bonus_time ?? 0;
  const direReserve = gsiData.draft?.dire_bonus_time ?? 0;

  // Only a real draft action can start a new countdown. A late whole-second payload can be
  // more than the tolerance ahead of the local clock, so drift alone cannot identify a new turn.
  const shownRemainingMs = current === null ? 0 : Math.max(0, current.deadline - now);
  if (
    current === null ||
    current.activeteam !== activeteam ||
    current.isPick !== isPick ||
    current.turnKey !== turnKey
  ) {
    return {
      turnKey,
      deadline: now + feedRemainingMs,
      radiantReserve,
      direReserve,
      reserveSampledAt: now,
      activeteam,
      isPick,
      pausedAt: paused ? now : null
    };
  }

  const projected = projectReserves(current, now);
  // Within a turn all three clocks only decrease. Catch up to lower authoritative readings,
  // but do not add seconds back for stale/repeated packets. Rebase each reserve independently,
  // preserving the other's fractional countdown instead of snapping both to whole seconds.
  const deadline =
    shownRemainingMs - feedRemainingMs > TIMER_RESYNC_TOLERANCE_MS
      ? now + feedRemainingMs
      : current.deadline;
  const radiantDrifted = (projected.radiant - radiantReserve) * 1000 > TIMER_RESYNC_TOLERANCE_MS;
  const direDrifted = (projected.dire - direReserve) * 1000 > TIMER_RESYNC_TOLERANCE_MS;

  if (deadline === current.deadline && !radiantDrifted && !direDrifted) {
    return current;
  }
  return {
    ...current,
    deadline,
    radiantReserve: radiantDrifted ? radiantReserve : projected.radiant,
    direReserve: direDrifted ? direReserve : projected.dire,
    reserveSampledAt: now
  };
}

// Consecutive picks/bans can belong to the same side. Slot changes distinguish those turns
// even when activeteam/pick stay equal; the match id also separates games and replay seeks.
function getTurnKey(gsiData: DotaGsiData): string {
  const slots = ['team2', 'team3'] as const;
  return JSON.stringify([
    gsiData.map?.matchid ?? '',
    ...slots.map((side) =>
      Object.entries(gsiData.draft?.[side] ?? {})
        .filter(
          ([key, value]) => /^(pick|ban)\d+_id$/.test(key) && typeof value === 'number' && value > 0
        )
        .sort(([a], [b]) => a.localeCompare(b))
    )
  ]);
}

export function readDraftTimers(sync: TimerSync | null, realNow: number): DraftTimerFigures {
  if (sync === null) {
    return { remaining: '', radiant: '', dire: '' };
  }
  const now = sync.pausedAt ?? realNow;
  const remaining = Math.max(0, Math.ceil((sync.deadline - now) / 1000));
  const reserves = projectReserves(sync, now);
  return {
    remaining: String(remaining),
    radiant: formatReserve(reserves.radiant),
    dire: formatReserve(reserves.dire)
  };
}

function applyPauseState(
  sync: TimerSync | null,
  paused: boolean,
  realNow: number
): TimerSync | null {
  if (sync === null) {
    return null;
  }
  if (sync.pausedAt !== null && !paused) {
    const pausedFor = realNow - sync.pausedAt;
    return {
      ...sync,
      deadline: sync.deadline + pausedFor,
      reserveSampledAt: sync.reserveSampledAt + pausedFor,
      pausedAt: null
    };
  }
  if (sync.pausedAt === null && paused) {
    return { ...sync, pausedAt: realNow };
  }
  return sync;
}

function projectReserves(sync: TimerSync, now: number): { radiant: number; dire: number } {
  const overdraft = Math.max(0, now - Math.max(sync.deadline, sync.reserveSampledAt)) / 1000;
  return {
    radiant:
      sync.activeteam === 2 ? Math.max(0, sync.radiantReserve - overdraft) : sync.radiantReserve,
    dire: sync.activeteam === 3 ? Math.max(0, sync.direReserve - overdraft) : sync.direReserve
  };
}

function formatReserve(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
