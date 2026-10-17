<script lang="ts">
  import ImageIcon from '@lucide/svelte/icons/image';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash-2';

  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { knownPlayers } from '$lib/state/knownPlayers.svelte.js';
  import { seriesState } from '$lib/state/seriesState.svelte.js';
  import { teams } from '$lib/state/teams.svelte.js';
  import type { Team } from '../../shared/team.js';

  let addName = $state('');
  let addTag = $state('');

  async function addTeam(): Promise<void> {
    const name = addName.trim();
    if (name === '') {
      return;
    }

    const saved = await teams.add({
      id: globalThis.crypto.randomUUID(),
      name,
      tag: addTag.trim(),
      logoPath: null,
      externalTeamId: null
    });
    if (!saved) return;
    addName = '';
    addTag = '';
  }

  function rename(team: Team, event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const name = input.value.trim();
    if (name === '') {
      input.value = team.name;
      return;
    }
    void teams.update(team.id, { name });
  }

  function retag(team: Team, tag: string): void {
    void teams.update(team.id, { tag: tag.trim() });
  }

  function chooseLogo(id: string): void {
    void teams.pickLogo(id);
  }

  function linkedPlayerCount(team: Team): number {
    return knownPlayers.players.filter((player) => player.teamId === team.id).length;
  }

  function relink(team: Team, event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const value = input.value.trim();
    const externalTeamId = value === '' ? null : Number(value);
    if (externalTeamId !== null && (!Number.isSafeInteger(externalTeamId) || externalTeamId <= 0)) {
      input.value = team.externalTeamId?.toString() ?? '';
      return;
    }
    void teams.update(team.id, { externalTeamId });
  }

  async function removeTeam(team: Team): Promise<void> {
    const manual = seriesState.snapshot?.manual;
    for (const side of ['radiant', 'dire'] as const) {
      if (manual?.[side] === team.id) await seriesState.setTeam(side, null);
    }
    await teams.remove(team.id);
  }

  function inputValue(event: Event): string {
    return (event.currentTarget as HTMLInputElement).value;
  }
</script>

<div class="flex min-h-0 flex-col rounded-lg border bg-card p-4 shadow-sm">
  <div class="mb-3 flex items-center justify-between gap-2">
    <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teams</span>
    <span class="text-xs text-muted-foreground">{teams.teams.length}</span>
  </div>

  {#if teams.error || teams.warning || teams.pending}
    <p role="status" class="mb-2 text-xs text-destructive">
      {teams.error ?? teams.warning ?? 'Saving…'}
    </p>
  {/if}

  <form
    class="mb-3 flex items-end gap-2"
    onsubmit={(event) => {
      event.preventDefault();
      void addTeam();
    }}
  >
    <div class="flex flex-1 flex-col gap-1">
      <span class="text-xs text-muted-foreground">Team name</span>
      <Input bind:value={addName} placeholder="e.g. Taneli Esports" aria-label="New team name" />
    </div>
    <div class="flex w-24 flex-col gap-1">
      <span class="text-xs text-muted-foreground">Tag</span>
      <Input bind:value={addTag} placeholder="TNL" aria-label="New team tag" />
    </div>
    <Button
      type="submit"
      size="icon"
      disabled={teams.pending > 0 || addName.trim() === ''}
      aria-label="Add team"
    >
      <PlusIcon />
    </Button>
  </form>

  <div class="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto rounded-md border">
    {#if teams.teams.length === 0}
      <div class="px-3 py-6 text-center text-sm text-muted-foreground">
        No teams yet. League games add them automatically; add them here for local lobbies.
      </div>
    {:else}
      {#each teams.teams as team (team.id)}
        {@const linked = linkedPlayerCount(team)}
        <div class="flex items-center gap-2 px-3 py-2">
          {#if team.logoPath !== null}
            <img src={team.logoPath} alt="" class="size-8 shrink-0 rounded object-contain" />
          {:else}
            <div
              class="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground"
            >
              <ImageIcon class="size-4" />
            </div>
          {/if}
          <Input
            class="min-w-28 flex-1"
            value={team.name}
            placeholder="Name"
            aria-label="Rename {team.name}"
            onchange={(event) => rename(team, event)}
          />
          <Input
            class="w-16"
            value={team.tag}
            placeholder="Tag"
            aria-label="Tag for {team.name}"
            onchange={(event) => retag(team, inputValue(event))}
          />
          <Input
            class="w-24"
            value={team.externalTeamId?.toString() ?? ''}
            placeholder="Valve ID"
            inputmode="numeric"
            title="Valve team ID: league tickets show this team's name and logo when it plays"
            aria-label="Valve team ID for {team.name}"
            onchange={(event) => relink(team, event)}
          />
          <Button
            size="sm"
            variant="ghost"
            onclick={() => chooseLogo(team.id)}
            aria-label="Choose logo for {team.name}"
          >
            Logo…
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={linked > 0}
            title={linked > 0
              ? `${linked} known ${linked === 1 ? 'player is' : 'players are'} linked to this team`
              : `Remove ${team.name}`}
            onclick={() => void removeTeam(team)}
            aria-label="Remove {team.name}"
          >
            <TrashIcon />
          </Button>
        </div>
      {/each}
    {/if}
  </div>
</div>
