import { ipcMain } from 'electron';

import type { KnownPlayersStore } from '../../persistence/knownPlayersStore.js';
import type { OverlayGsiEventStream } from '../../runtime/overlayGsiEventStream.js';
import type { KnownPlayer } from '../../shared/knownPlayer.js';
import { KNOWN_PLAYERS_GET_CHANNEL, KNOWN_PLAYERS_SET_CHANNEL } from '../../shared/ipcChannels.js';

// Persists the known-players list and fans it out to live-overlay clients. Like the settings IPC,
// the main process is the single source of truth; the renderer's preview reads the same list over
// the get channel and drives itself reactively, so this is the persistence + SSE broadcast path.
export function registerKnownPlayersIpc(
  store: KnownPlayersStore,
  eventStream: OverlayGsiEventStream
): () => void {
  // Seed the stream so an overlay opened before the studio still gets the saved list.
  eventStream.setKnownPlayers(store.list());

  ipcMain.handle(KNOWN_PLAYERS_GET_CHANNEL, () => store.list());
  ipcMain.handle(KNOWN_PLAYERS_SET_CHANNEL, (_event, players: KnownPlayer[]) => {
    store.replaceAll(players);
    eventStream.setKnownPlayers(players);
  });

  return () => {
    ipcMain.removeHandler(KNOWN_PLAYERS_GET_CHANNEL);
    ipcMain.removeHandler(KNOWN_PLAYERS_SET_CHANNEL);
  };
}
