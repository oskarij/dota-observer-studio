import assert from 'node:assert/strict';
import test from 'node:test';

import type { KnownPlayer } from '../src/shared/knownPlayer.js';
import { parseKnownPlayersCsv, serializeKnownPlayersCsv } from '../src/shared/knownPlayersCsv.js';

test('serializes the header and rows', () => {
  const players: KnownPlayer[] = [
    { accountId: '123', name: 'Alice', mmr: 5300 },
    { accountId: '456', name: 'Bob', mmr: null }
  ];

  assert.equal(
    serializeKnownPlayersCsv(players),
    'accountId,name,mmr\r\n123,Alice,5300\r\n456,Bob,'
  );
});

test('quotes names containing a comma or quote', () => {
  const players: KnownPlayer[] = [{ accountId: '1', name: 'Last, First "LF"', mmr: null }];

  assert.equal(serializeKnownPlayersCsv(players), 'accountId,name,mmr\r\n1,"Last, First ""LF""",');
});

test('round-trips through serialize/parse', () => {
  const players: KnownPlayer[] = [
    { accountId: '123', name: 'Alice, the "great"', mmr: 5300 },
    { accountId: '456', name: 'Bob', mmr: null }
  ];

  assert.deepEqual(parseKnownPlayersCsv(serializeKnownPlayersCsv(players)).players, players);
});

test('skips invalid account ids, blank names, and duplicates', () => {
  const csv = [
    'accountId,name,mmr',
    'abc,Bad Id,1000', // non-numeric account id
    '111,,1000', // blank name
    '222,Valid,2000',
    '222,Duplicate,3000', // duplicate account id
    '333,Rounded,2500.7' // mmr rounds
  ].join('\n');

  const result = parseKnownPlayersCsv(csv);

  assert.deepEqual(result.players, [
    { accountId: '222', name: 'Valid', mmr: 2000 },
    { accountId: '333', name: 'Rounded', mmr: 2501 }
  ]);
  assert.equal(result.skipped, 3);
});

test('parses a file without a header row', () => {
  const result = parseKnownPlayersCsv('789,Carol,4200');

  assert.deepEqual(result.players, [{ accountId: '789', name: 'Carol', mmr: 4200 }]);
});

test('ignores trailing blank lines', () => {
  const result = parseKnownPlayersCsv('accountId,name,mmr\r\n123,Alice,5000\r\n\r\n');

  assert.deepEqual(result.players, [{ accountId: '123', name: 'Alice', mmr: 5000 }]);
  assert.equal(result.skipped, 0);
});
