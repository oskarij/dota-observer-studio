import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readDraftTimers,
  syncDraftTimers,
  type DraftTimerFigures,
  type TimerSync
} from '../src/overlay/elements/draftScreen/draftTimers.js';
import type { DotaGsiData } from '../src/shared/dotaGsiPayload.js';

function feed(
  remaining: number,
  radiant: number,
  dire: number,
  side = 3,
  paused = false,
  pick = true
): DotaGsiData {
  return {
    map: { game_state: 'DOTA_GAMERULES_STATE_HERO_SELECTION', paused },
    draft: {
      activeteam: side,
      pick,
      activeteam_time_remaining: remaining,
      radiant_bonus_time: radiant,
      dire_bonus_time: dire
    }
  };
}

function seconds(text: string): number {
  const parts = text.split(':').map(Number);
  return parts.length === 1 ? (parts[0] ?? 0) : (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

interface Sample {
  at: number;
  figures: DraftTimerFigures;
}

function simulate(side: number, round: (seconds: number) => number, staleMs: number): Sample[] {
  let sync: TimerSync | null = null;
  let nextFeed = 0;
  let payloads = 0;
  const samples: Sample[] = [];
  const intervals = [80, 120, 90, 110, 140, 60, 100];

  // Two minutes of irregular ~10 Hz payloads plus the board's independent 250 ms render tick.
  // Keep every render, including before AND after an arriving payload, so transient reversals count.
  for (let now = 0; now <= 120_000; now += 10) {
    if (now % 250 === 0 && sync !== null) {
      samples.push({ at: now, figures: readDraftTimers(sync, now) });
    }
    if (now >= nextFeed) {
      const sampledAt = Math.max(0, now - (payloads % 7 === 6 ? staleMs : 0));
      const remaining = Math.max(0, round(12 - sampledAt / 1000));
      const reserve = Math.max(0, round(90 - Math.max(0, sampledAt - 12_000) / 1000));
      sync = syncDraftTimers(
        sync,
        feed(remaining, side === 2 ? reserve : 114, side === 3 ? reserve : 76, side),
        now
      );
      samples.push({ at: now, figures: readDraftTimers(sync, now) });
      nextFeed = now + (intervals[payloads % intervals.length] ?? 100);
      payloads += 1;
    }
  }
  return samples;
}

for (const side of [2, 3]) {
  for (const rounding of ['floor', 'ceil'] as const) {
    for (const delay of [0, 1100, 2500]) {
      test(`${side === 2 ? 'Radiant' : 'Dire'} reserve never ticks backwards (${rounding}, ${delay} ms stale payloads)`, () => {
        const samples = simulate(side, Math[rounding], delay);
        const active = side === 2 ? 'radiant' : 'dire';
        const inactive = side === 2 ? 'dire' : 'radiant';
        const backwards: string[] = [];
        samples.forEach((sample, index) => {
          const previous = samples[index - 1];
          if (previous !== undefined) {
            for (const clock of ['remaining', active] as const) {
              if (seconds(sample.figures[clock]) > seconds(previous.figures[clock])) {
                backwards.push(
                  `${clock}: ${previous.figures[clock]} -> ${sample.figures[clock]} at ${sample.at} ms`
                );
              }
            }
          }
          assert.equal(sample.figures[inactive], side === 2 ? '1:16' : '1:54');
        });
        assert.deepEqual(backwards, [], backwards.slice(0, 12).join('\n'));
        assert.equal(samples.at(-1)?.figures[active], '0:00');
        assert.equal(samples.at(-1)?.figures.remaining, '0');
      });
    }
  }
}

test('repeated zero pick times do not restart reserve time', () => {
  let sync = syncDraftTimers(null, feed(0, 114, 76), 0);
  for (let now = 100; now <= 10_000; now += 100) {
    sync = syncDraftTimers(sync, feed(0, 114, 76 - Math.floor(now / 1000)), now);
  }
  assert.deepEqual(readDraftTimers(sync, 10_000), {
    remaining: '0',
    radiant: '1:54',
    dire: '1:06'
  });
});

for (const startingRemaining of [0, 12]) {
  test(`pause/resume freezes both clocks (${startingRemaining === 0 ? 'reserve' : 'pick'} active)`, () => {
    let sync = syncDraftTimers(null, feed(startingRemaining, 114, 76), 0);
    const pausedFeed = feed(
      Math.max(0, startingRemaining - 2),
      114,
      startingRemaining === 0 ? 74 : 76,
      3,
      true
    );
    sync = syncDraftTimers(sync, pausedFeed, 2000);
    const frozen = readDraftTimers(sync, 2000);
    for (let now = 2100; now <= 32_000; now += 100) {
      sync = syncDraftTimers(sync, pausedFeed, now);
      assert.deepEqual(readDraftTimers(sync, now), frozen);
    }
    sync = syncDraftTimers(
      sync,
      { ...pausedFeed, map: { ...pausedFeed.map, paused: false } },
      32_000
    );
    assert.deepEqual(readDraftTimers(sync, 32_000), frozen);
    const resumed = readDraftTimers(sync, 33_000);
    const active = startingRemaining === 0 ? 'dire' : 'remaining';
    assert.equal(seconds(resumed[active]), seconds(frozen[active]) - 1);
  });
}

test('a turn change starts the new timer and stops draining the previous side', () => {
  let sync = syncDraftTimers(null, feed(0, 114, 76), 0);
  assert.equal(readDraftTimers(sync, 2000).dire, '1:14');
  sync = syncDraftTimers(sync, feed(10, 114, 74, 2), 2000);
  assert.deepEqual(readDraftTimers(sync, 3000), { remaining: '9', radiant: '1:54', dire: '1:14' });
  assert.deepEqual(readDraftTimers(sync, 13_000), {
    remaining: '0',
    radiant: '1:53',
    dire: '1:14'
  });
});

test('a new pick/ban phase on the same side accepts its fresh clock', () => {
  let sync = syncDraftTimers(null, feed(0, 114, 76), 0);
  sync = syncDraftTimers(sync, feed(15, 114, 74, 3, false, false), 2000);
  assert.equal(readDraftTimers(sync, 2000).remaining, '15');
});

test('a real forward clock correction catches up to the feed', () => {
  let sync = syncDraftTimers(null, feed(0, 114, 76), 0);
  sync = syncDraftTimers(sync, feed(0, 114, 50), 1000);
  assert.equal(readDraftTimers(sync, 1000).dire, '0:50');
});

test('a stale reserve reading cannot add the previous second back', () => {
  let sync = syncDraftTimers(null, feed(0, 114, 90), 0);
  assert.equal(readDraftTimers(sync, 1000).dire, '1:29');
  sync = syncDraftTimers(sync, feed(0, 114, 90), 1300);
  assert.equal(readDraftTimers(sync, 1300).dire, '1:29');
  sync = syncDraftTimers(sync, feed(0, 114, 89), 1400);
  assert.equal(readDraftTimers(sync, 1400).dire, '1:29');
  assert.equal(readDraftTimers(sync, 2000).dire, '1:28');
});

test('correcting the inactive reserve does not rewind the running reserve', () => {
  let sync = syncDraftTimers(null, feed(0, 114, 90), 0);
  assert.equal(readDraftTimers(sync, 1000).dire, '1:29');
  sync = syncDraftTimers(sync, feed(0, 110, 90), 1100);
  assert.deepEqual(readDraftTimers(sync, 1100), { remaining: '0', radiant: '1:50', dire: '1:29' });
  assert.equal(readDraftTimers(sync, 2000).dire, '1:28');
});

test('consecutive picks on the same side start a new timer when the picked slot changes', () => {
  let sync = syncDraftTimers(null, feed(0, 114, 76), 0);
  const next = feed(30, 114, 74);
  sync = syncDraftTimers(sync, { ...next, draft: { ...next.draft, team3: { pick0_id: 6 } } }, 2000);
  assert.deepEqual(readDraftTimers(sync, 2000), { remaining: '30', radiant: '1:54', dire: '1:14' });
});

test('a new match and reconnect accept fresh timer values', () => {
  const initial = feed(0, 114, 10);
  const next = feed(20, 130, 130);
  let sync = syncDraftTimers(null, { ...initial, map: { ...initial.map, matchid: '100' } }, 0);
  sync = syncDraftTimers(sync, { ...next, map: { ...next.map, matchid: '101' } }, 2000);
  assert.deepEqual(readDraftTimers(sync, 2000), { remaining: '20', radiant: '2:10', dire: '2:10' });
  assert.equal(readDraftTimers(syncDraftTimers(null, next, 50_000), 50_000).remaining, '20');
});

test('after a gap, stale packets cannot rewind the reserve and fresh packets still agree', () => {
  let sync = syncDraftTimers(null, feed(0, 114, 76), 0);
  assert.equal(readDraftTimers(sync, 10_000).dire, '1:06');
  sync = syncDraftTimers(sync, feed(0, 114, 76), 10_000);
  assert.equal(readDraftTimers(sync, 10_000).dire, '1:06');
  sync = syncDraftTimers(sync, feed(0, 114, 66), 10_100);
  assert.equal(readDraftTimers(sync, 11_000).dire, '1:05');
});
