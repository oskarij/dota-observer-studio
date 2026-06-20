<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash-2';
  import UploadIcon from '@lucide/svelte/icons/upload';
  import XIcon from '@lucide/svelte/icons/x';

  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { knownPlayers } from '$lib/state/knownPlayers.svelte.js';
  import { isValidAccountId } from '../../shared/accountId.js';
  import type { KnownPlayer } from '../../shared/knownPlayer.js';
  import {
    parseKnownPlayersCsv,
    parseMmr,
    serializeKnownPlayersCsv
  } from '../../shared/knownPlayersCsv.js';

  // Editable draft fields are strings (raw input); committed to a KnownPlayer on add/save.
  interface PlayerDraft {
    accountId: string;
    name: string;
    mmr: string;
  }

  const EMPTY_DRAFT: PlayerDraft = { accountId: '', name: '', mmr: '' };

  let search = $state('');
  let addDraft = $state<PlayerDraft>({ ...EMPTY_DRAFT });
  // Account id of the row being edited (null when none). It's the primary key, so it's not editable inline; change it by removing and re-adding.
  let editingId = $state<string | null>(null);
  let editDraft = $state<PlayerDraft>({ ...EMPTY_DRAFT });

  let filtered = $derived.by(() => {
    const query = search.trim().toLowerCase();
    const players = knownPlayers.players;

    if (query === '') {
      return players;
    }

    return players.filter(
      (player) => player.name.toLowerCase().includes(query) || player.accountId.includes(query)
    );
  });

  function toPlayer(draft: PlayerDraft): KnownPlayer {
    return {
      accountId: draft.accountId.trim(),
      name: draft.name.trim(),
      mmr: parseMmr(draft.mmr)
    };
  }

  let canAdd = $derived(
    isValidAccountId(addDraft.accountId) &&
      addDraft.name.trim() !== '' &&
      !knownPlayers.has(addDraft.accountId.trim())
  );

  function add(): void {
    if (!canAdd) {
      return;
    }

    knownPlayers.add(toPlayer(addDraft));
    addDraft = { ...EMPTY_DRAFT };
  }

  function startEdit(player: KnownPlayer): void {
    editingId = player.accountId;
    editDraft = {
      accountId: player.accountId,
      name: player.name,
      mmr: player.mmr === null ? '' : String(player.mmr)
    };
  }

  function cancelEdit(): void {
    editingId = null;
  }

  function saveEdit(): void {
    if (editingId === null || editDraft.name.trim() === '') {
      return;
    }

    knownPlayers.update(editingId, toPlayer(editDraft));
    editingId = null;
  }

  let csvStatus = $state<string | null>(null);
  let busy = $state(false);

  async function exportCsv(): Promise<void> {
    const api = globalThis.window?.dotaSpectatorTools?.knownPlayers;
    if (api === undefined || busy) {
      return;
    }

    busy = true;
    csvStatus = null;
    try {
      const result = await api.exportCsv(serializeKnownPlayersCsv(knownPlayers.players));
      csvStatus = result.ok
        ? `Exported ${knownPlayers.players.length} players.`
        : (result.reason ?? null);
    } finally {
      busy = false;
    }
  }

  // Import replaces the whole list (it's a backup/restore, not a merge); rows that fail validation
  // are skipped and reported.
  async function importCsv(): Promise<void> {
    const api = globalThis.window?.dotaSpectatorTools?.knownPlayers;
    if (api === undefined || busy) {
      return;
    }

    busy = true;
    csvStatus = null;
    try {
      const result = await api.importCsv();
      if (!result.ok || result.text === undefined) {
        csvStatus = result.reason ?? null;
        return;
      }

      const { players, skipped } = parseKnownPlayersCsv(result.text);
      knownPlayers.replaceAll(players);
      csvStatus =
        `Imported ${players.length} player${players.length === 1 ? '' : 's'}` +
        (skipped > 0 ? ` (${skipped} row${skipped === 1 ? '' : 's'} skipped).` : '.');
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex h-full min-h-0 flex-col rounded-lg border bg-card p-4 shadow-sm">
  <div class="mb-3 flex items-center justify-between gap-2">
    <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Known players
    </span>
    <div class="flex items-center gap-1">
      <span class="mr-1 text-xs text-muted-foreground">{knownPlayers.players.length}</span>
      <Button
        size="sm"
        variant="ghost"
        onclick={importCsv}
        disabled={busy}
        aria-label="Import known players from CSV"
      >
        <DownloadIcon />
        Import
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onclick={exportCsv}
        disabled={busy || knownPlayers.players.length === 0}
        aria-label="Export known players to CSV"
      >
        <UploadIcon />
        Export
      </Button>
    </div>
  </div>

  {#if csvStatus !== null}
    <p class="mb-2 text-xs text-muted-foreground">{csvStatus}</p>
  {/if}

  <form
    class="mb-3 flex items-end gap-2"
    onsubmit={(event) => {
      event.preventDefault();
      add();
    }}
  >
    <div class="flex flex-1 flex-col gap-1">
      <span class="text-xs text-muted-foreground">Account ID</span>
      <Input bind:value={addDraft.accountId} placeholder="123456789" inputmode="numeric" />
    </div>
    <div class="flex flex-1 flex-col gap-1">
      <span class="text-xs text-muted-foreground">Name</span>
      <Input bind:value={addDraft.name} placeholder="Player name" />
    </div>
    <div class="flex w-24 flex-col gap-1">
      <span class="text-xs text-muted-foreground">MMR</span>
      <Input bind:value={addDraft.mmr} placeholder="—" inputmode="numeric" />
    </div>
    <Button type="submit" size="icon" disabled={!canAdd} aria-label="Add player">
      <PlusIcon />
    </Button>
  </form>

  <Input class="mb-2" bind:value={search} placeholder="Search by name or account ID" />

  <div class="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto rounded-md border">
    {#if filtered.length === 0}
      <div class="px-3 py-6 text-center text-sm text-muted-foreground">
        {knownPlayers.players.length === 0 ? 'No known players yet.' : 'No matches.'}
      </div>
    {:else}
      {#each filtered as player (player.accountId)}
        {#if editingId === player.accountId}
          <div class="flex items-center gap-2 px-3 py-2">
            <span class="w-28 shrink-0 truncate font-mono text-xs text-muted-foreground">
              {player.accountId}
            </span>
            <Input class="flex-1" bind:value={editDraft.name} placeholder="Name" />
            <Input class="w-20" bind:value={editDraft.mmr} placeholder="—" inputmode="numeric" />
            <Button
              size="icon-sm"
              variant="ghost"
              onclick={saveEdit}
              disabled={editDraft.name.trim() === ''}
              aria-label="Save"
            >
              <CheckIcon />
            </Button>
            <Button size="icon-sm" variant="ghost" onclick={cancelEdit} aria-label="Cancel">
              <XIcon />
            </Button>
          </div>
        {:else}
          <div class="flex items-center gap-2 px-3 py-2">
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</span>
            <span class="w-28 shrink-0 truncate font-mono text-xs text-muted-foreground">
              {player.accountId}
            </span>
            <span class="w-16 shrink-0 text-right text-sm tabular-nums">
              {player.mmr === null ? '—' : player.mmr}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              onclick={() => startEdit(player)}
              aria-label="Edit {player.name}"
            >
              <PencilIcon />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onclick={() => knownPlayers.remove(player.accountId)}
              aria-label="Remove {player.name}"
            >
              <TrashIcon />
            </Button>
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>
