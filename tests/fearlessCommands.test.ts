import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFearlessRepository,
  EMPTY_FEARLESS_DATA
} from '../src/persistence/fearlessRepository.js';
import { createFearlessService } from '../src/runtime/fearlessService.js';
import { bannedHeroIdsFromSeries } from '../src/shared/fearlessDraft.js';
import type { MatchInfoFetchResult } from '../src/runtime/valveClient.js';

function harness() {
  let data = structuredClone(EMPTY_FEARLESS_DATA);
  let fail = false;
  const storage = {
    get: <K extends keyof typeof data>(key: K): (typeof data)[K] => structuredClone(data[key]),
    set: (next: Partial<typeof data>): void => {
      if (fail) throw new Error('Disk full');
      data = structuredClone({ ...data, ...next });
    }
  };
  const store = createFearlessRepository(storage);
  const output: number[][] = [];
  let resolve: (value: MatchInfoFetchResult) => void = () => {
    throw new Error('Promise not initialized');
  };
  const promise = new Promise<MatchInfoFetchResult>((done) => {
    resolve = done;
  });
  const pending = { promise, resolve };
  const service = createFearlessService({
    store,
    leagueId: () => 9,
    fetchMatch: () => pending.promise,
    publish: () => {
      output.push(bannedHeroIdsFromSeries(store.getSeries()));
    },
    notifyWatched() {}
  });
  return {
    store,
    service,
    storage,
    output,
    pending,
    fail: () => {
      fail = true;
    }
  };
}

test('a delayed match lookup cannot change a newly selected series', async () => {
  const h = harness();
  const revision = h.service.getSeries().revision;
  const fetch = h.service.fetchMatch('100');
  h.store.resetSeries();
  h.pending.resolve({
    outcome: 'resolved',
    heroIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  });
  const result = await fetch;
  assert.ok(result.ok);
  assert.equal(result.game.matchId, '100');
  assert.equal(
    h.service.edit({ kind: 'add', game: { ...result.game, label: 'Game' } }, revision).ok,
    false
  );
  assert.deepEqual(h.service.getSeries().games, []);
  assert.equal(h.service.getWatched()[0]?.matchId, '100');
});

test('manual picks survive automatic refresh and repository reopen, and can return to automatic picks', () => {
  const h = harness();
  const automatic = [{ matchId: '100', heroIds: [1, 2], label: 'Automatic' }];
  h.store.setAutomaticSeries(automatic);
  const result = h.service.edit(
    { kind: 'add', game: { matchId: 'manual-1', heroIds: [3, 4], label: 'Manual' } },
    h.service.getSeries().revision
  );
  assert.ok(result.ok);
  h.store.setAutomaticSeries([{ matchId: '200', heroIds: [5, 6], label: 'New automatic' }]);
  const reopened = createFearlessRepository(h.storage);
  assert.deepEqual(
    reopened.getSeries().map((game) => game.matchId),
    ['100', 'manual-1']
  );
  assert.equal(reopened.getSeriesState().manualOverride, true);
  assert.ok(h.service.edit({ kind: 'automatic' }, h.service.getSeries().revision).ok);
  assert.deepEqual(
    h.service.getSeries().games.map((game) => game.matchId),
    ['200']
  );
  assert.equal(h.service.getSeries().manualOverride, false);
});

test('invalid picks and persistence failures never publish a successful edit', () => {
  const h = harness();
  const revision = h.service.getSeries().revision;
  for (const heroIds of [[1, 1], [-1], [NaN], [], Array.from({ length: 11 }, (_, i) => i + 1)]) {
    assert.equal(
      h.service.edit({ kind: 'add', game: { matchId: '100', label: 'Invalid', heroIds } }, revision)
        .ok,
      false
    );
  }
  h.fail();
  assert.deepEqual(
    h.service.edit(
      { kind: 'add', game: { matchId: '100', label: 'Valid', heroIds: [1, 2] } },
      revision
    ),
    { ok: false, reason: 'Disk full' }
  );
  assert.deepEqual(h.service.getSeries().games, []);
  assert.deepEqual(h.output, []);
});

test('reopening after an interrupted series change clears the previous series pool', () => {
  const h = harness();
  h.store.selectSeries('9:10');
  h.store.setSeries([{ matchId: '100', heroIds: [1, 2], label: 'Manual' }]);
  const reopened = createFearlessRepository(h.storage);
  reopened.selectSeries('9:11');
  assert.deepEqual(reopened.getSeries(), []);
  assert.equal(reopened.getSeriesState().manualOverride, false);
  assert.equal(h.storage.get('seriesKey'), '9:11');
});

test('adopting a series key preserves existing manual pools when upgrading', () => {
  const h = harness();
  h.store.setSeries([{ matchId: '100', heroIds: [1, 2], label: 'Manual' }]);
  h.store.selectSeries('9:10');
  const reopened = createFearlessRepository(h.storage);
  reopened.selectSeries('9:10');
  assert.equal(reopened.getSeries()[0]?.matchId, '100');
  assert.equal(reopened.getSeriesState().manualOverride, true);
});
