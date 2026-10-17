import assert from 'node:assert/strict';
import test from 'node:test';

import type { KnownPlayer } from '../src/shared/knownPlayer.js';
import { parseKnownPlayersCsv, serializeKnownPlayersCsv } from '../src/shared/knownPlayersCsv.js';

test('serializes the header and rows', () => {
  const players: KnownPlayer[] = [
    { accountId: '123', name: 'Alice', mmr: 5300, teamId: 'team-a' },
    { accountId: '456', name: 'Bob', mmr: null, teamId: null }
  ];

  assert.equal(
    serializeKnownPlayersCsv(players),
    'accountId,name,mmr,teamId\r\n123,Alice,5300,team-a\r\n456,Bob,,'
  );
});

test('quotes names containing a comma or quote', () => {
  const players: KnownPlayer[] = [
    { accountId: '1', name: 'Last, First "LF"', mmr: null, teamId: null }
  ];

  assert.equal(
    serializeKnownPlayersCsv(players),
    'accountId,name,mmr,teamId\r\n1,"Last, First ""LF""",,'
  );
});

test('round-trips through serialize/parse', () => {
  const players: KnownPlayer[] = [
    { accountId: '123', name: 'Alice, the "great"', mmr: 5300, teamId: 'team-a' },
    { accountId: '456', name: 'Bob', mmr: null, teamId: null }
  ];

  assert.deepEqual(parseKnownPlayersCsv(serializeKnownPlayersCsv(players)).players, players);
});

test('skips invalid account ids, blank names, and duplicates', () => {
  const csv = [
    'accountId,name,mmr,teamId',
    'abc,Bad Id,1000,', // non-numeric account id
    '111,,1000,', // blank name
    '222,Valid,2000,',
    '222,Duplicate,3000,', // duplicate account id
    '333,Rounded,2500.7,' // mmr rounds
  ].join('\n');

  const result = parseKnownPlayersCsv(csv);

  assert.deepEqual(result.players, [
    { accountId: '222', name: 'Valid', mmr: 2000, teamId: null },
    { accountId: '333', name: 'Rounded', mmr: 2501, teamId: null }
  ]);
  assert.equal(result.skipped, 3);
});

test('parses a pre-teams 3-column file without a teamId column', () => {
  const result = parseKnownPlayersCsv('accountId,name,mmr\r\n789,Carol,4200');

  assert.deepEqual(result.players, [{ accountId: '789', name: 'Carol', mmr: 4200, teamId: null }]);
});

test('parses a file without a header row', () => {
  const result = parseKnownPlayersCsv('789,Carol,4200');

  assert.deepEqual(result.players, [{ accountId: '789', name: 'Carol', mmr: 4200, teamId: null }]);
});

test('ignores trailing blank lines', () => {
  const result = parseKnownPlayersCsv('accountId,name,mmr,teamId\r\n123,Alice,5000,\r\n\r\n');

  assert.deepEqual(result.players, [{ accountId: '123', name: 'Alice', mmr: 5000, teamId: null }]);
  assert.equal(result.skipped, 0);
});

test('an impossible MMR is dropped instead of rejecting the row', () => {
  const { players } = parseKnownPlayersCsv(
    'accountId,name,mmr\r\n1,Neg,-1\r\n2,Big,1e400\r\n3,Ok,5000.4'
  );
  assert.deepEqual(
    players.map((player) => player.mmr),
    [null, null, 5000]
  );
});

test('a semicolon-separated file parses to no players rather than a roster of empty rows', () => {
  assert.deepEqual(parseKnownPlayersCsv('accountId;name;mmr\r\n900000101;nova;9500').players, []);
});
