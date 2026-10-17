import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { createOverlayGsiEventStream } from '../src/runtime/overlayGsiEventStream.js';
import { projectOverlayPayload } from '../src/shared/overlayPayload.js';
import { getSelectedDotaGsiPlayer } from '../src/shared/dotaGsiPayload.js';
import { createDefaultOverlayConfig } from '../src/shared/componentSettings.js';

function payload(health = 100, name = 'Player') {
  return {
    provider: { timestamp: health },
    map: { game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS' as const, clock_time: health },
    hero: { team2: { player0: { selected_unit: true, health, mana: health } } },
    player: { team2: { player0: { accountid: '123', name, gold: health } } },
    previously: { hero: { health: health - 1 } }
  };
}

function client(stream: ReturnType<typeof createOverlayGsiEventStream>, statusOnly = false) {
  const request = Object.assign(new EventEmitter(), {
    url: `/events${statusOnly ? '?statusOnly=1' : ''}`
  });
  const messages: string[] = [];
  const response = {
    destroyed: false,
    writableLength: 0,
    writeHead() {},
    write(message: string) {
      messages.push(message);
      return true;
    },
    end() {
      this.destroyed = true;
    },
    destroy() {
      this.destroyed = true;
    }
  };
  stream.connect(request as IncomingMessage, response as unknown as ServerResponse);
  return { request, response, messages };
}

test('overlay projection preserves selection/name and discards rapidly changing unused fields', () => {
  const input = payload();
  const before = structuredClone(input);
  const projected = projectOverlayPayload(input);
  assert.deepEqual(projected, projectOverlayPayload(payload(99)));
  assert.equal(getSelectedDotaGsiPlayer(projected)?.player?.name, 'Player');
  assert.deepEqual(input, before, 'main-process services still receive the original data');
  assert.notDeepEqual(projected, projectOverlayPayload(payload(99, 'Renamed')));
  assert.equal(getSelectedDotaGsiPlayer(projectOverlayPayload({ ...input, hero: {} })), null);
});

test('unchanged visible state emits once; selections and names still update immediately', () => {
  const stream = createOverlayGsiEventStream();
  const connected = client(stream);
  connected.messages.length = 0;
  for (let index = 0; index < 600; index++) stream.broadcast(payload(index));
  assert.equal(connected.messages.length, 1);
  stream.broadcast(payload(1, 'Changed'));
  assert.equal(connected.messages.length, 2);
  stream.broadcast({ ...payload(), hero: {} });
  assert.equal(connected.messages.length, 3);
  stream.stop();
});

test('a status watcher receives liveness only, including initial connection', () => {
  const stream = createOverlayGsiEventStream();
  stream.setSettings(createDefaultOverlayConfig());
  stream.setKnownPlayers([{ accountId: '1', name: 'Name', mmr: null, teamId: null }]);
  stream.setStatus('live');
  stream.broadcast(payload());
  const watcher = client(stream, true);
  assert.equal(watcher.messages.length, 2);
  assert.match(watcher.messages[1] ?? '', /gsi-status\ndata: live/);
  stream.broadcast(payload(1, 'Different'));
  stream.setPlayerRank({ accountId: '1', rankTier: 80 });
  stream.setSettings(createDefaultOverlayConfig());
  assert.equal(watcher.messages.length, 2);
  stream.setStatus('stale');
  assert.match(watcher.messages.at(-1) ?? '', /gsi-status\ndata: stale/);
  stream.stop();
});

test('reconnect replays the latest snapshot, including when there were no data subscribers', () => {
  const stream = createOverlayGsiEventStream();
  client(stream, true);
  stream.setStatus('live');
  stream.broadcast(payload(1, 'First'));
  stream.broadcast(payload(2, 'Latest'));
  const connected = client(stream);
  assert.match(connected.messages.at(-1) ?? '', /Latest/);
  assert.equal(
    connected.messages.some((message) => message.includes('First')),
    false
  );
  const size = connected.messages.length;
  stream.broadcast(payload(3, 'Latest'));
  assert.equal(connected.messages.length, size);
  stream.setStatus('stale');
  const stale = client(stream);
  assert.equal(
    stale.messages.some((message) => message.startsWith('data:')),
    false
  );
  stream.setStatus('live');
  stream.broadcast(payload(3, 'Latest'));
  assert.match(stale.messages.at(-1) ?? '', /Latest/);
  stream.stop();
});

test('slow clients are disconnected before their queue grows without bound', () => {
  const stream = createOverlayGsiEventStream();
  const slow = client(stream);
  const healthy = client(stream);
  slow.response.writableLength = 300_000;
  stream.broadcast(payload());
  assert.equal(slow.response.destroyed, true);
  assert.equal(stream.getClientCount(), 1);
  assert.match(healthy.messages.at(-1) ?? '', /Player/);
  slow.request.emit('close');
  assert.equal(stream.getClientCount(), 1);
  stream.stop();
});

test('draft pause, turn, timers and match boundaries remain in the rendered snapshot', () => {
  const draft = {
    activeteam: 2,
    pick: true,
    activeteam_time_remaining: 15,
    radiant_bonus_time: 90,
    dire_bonus_time: 120,
    team2: { pick0_id: 1, pick0_class: 'npc_dota_hero_antimage', ban0_id: 2 }
  };
  const map = {
    game_state: 'DOTA_GAMERULES_STATE_HERO_SELECTION' as const,
    game_mode: 2,
    paused: true,
    matchid: '123'
  };
  const projected = projectOverlayPayload({ map, draft });
  assert.deepEqual(projected.map, map);
  assert.deepEqual(projected.draft, draft);
  assert.notDeepEqual(projected, projectOverlayPayload({ map: { ...map, paused: false }, draft }));
});
