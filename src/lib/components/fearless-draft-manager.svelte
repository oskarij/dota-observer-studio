<script lang="ts">
  import { onMount } from 'svelte';

  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash-2';

  import HeroIcons from '$lib/components/hero-icons.svelte';
  import HeroPicker from '$lib/components/hero-picker.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { fearlessSeries } from '$lib/state/fearlessSeries.svelte.js';
  import type { WatchedGame } from '../../shared/fearlessDraft.js';

  onMount(() => {
    void fearlessSeries.load();
    return fearlessSeries.subscribe();
  });

  let matchIdInput = $state('');
  let fetchStatus = $state<string | null>(null);
  let fetching = $state(false);
  let picking = $state(false);

  function confirmManual(heroIds: number[]): void {
    fearlessSeries.addManualSeriesGame(heroIds);
    picking = false;
  }

  function teamsLabel(game: WatchedGame): string | null {
    return game.radiantTeam !== undefined && game.direTeam !== undefined
      ? `${game.radiantTeam} vs ${game.direTeam}`
      : null;
  }

  // GSI carries no org team names, only player names; use them to identify spectated games.
  // playerNames is aligned with heroIds (team2/Radiant first, then team3/Dire), 5 per side.
  function hasPlayerNames(game: WatchedGame): boolean {
    return (game.playerNames ?? []).some((name) => name !== '');
  }

  function radiantNames(game: WatchedGame): string {
    return (game.playerNames ?? [])
      .slice(0, 5)
      .filter((name) => name !== '')
      .join(', ');
  }

  function direNames(game: WatchedGame): string {
    return (game.playerNames ?? [])
      .slice(5, 10)
      .filter((name) => name !== '')
      .join(', ');
  }

  let canFetch = $derived(/^\d+$/.test(matchIdInput.trim()) && !fetching);

  async function fetchMatch(): Promise<void> {
    if (!canFetch) {
      return;
    }

    fetching = true;
    fetchStatus = null;
    try {
      const result = await fearlessSeries.fetchMatch(matchIdInput.trim());
      if (result.ok) {
        fetchStatus = `Added match ${matchIdInput.trim()} to watched games.`;
        matchIdInput = '';
      } else {
        fetchStatus = result.reason ?? 'Could not fetch that match.';
      }
    } finally {
      fetching = false;
    }
  }

  function capturedLabel(game: WatchedGame): string {
    const when = new Date(game.capturedAt);
    const source = game.source === 'spectated' ? 'Spectated' : 'OpenDota';
    return `${source} · ${when.toLocaleString()}`;
  }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-3">
  <p class="max-w-2xl text-sm text-muted-foreground">
    Spectated games are recorded automatically. Add each finished game to the series before the next
    draft, and its heroes appear as banned on the draft overlay. For a game you didn't spectate,
    fetch it by match ID from OpenDota.
  </p>

  <!-- Add a game the operator didn't spectate: by match ID (OpenDota) or by hand-picking heroes. -->
  <div class="flex flex-col gap-2">
    <form
      class="flex items-end gap-2"
      onsubmit={(event) => {
        event.preventDefault();
        void fetchMatch();
      }}
    >
      <div class="flex w-56 flex-col gap-1">
        <span class="text-xs text-muted-foreground">Match ID</span>
        <Input bind:value={matchIdInput} placeholder="8123456789" inputmode="numeric" />
      </div>
      <Button type="submit" disabled={!canFetch}>
        {fetching ? 'Fetching…' : 'Fetch from OpenDota'}
      </Button>
      <Button type="button" variant="outline" disabled={picking} onclick={() => (picking = true)}>
        Pick heroes manually
      </Button>
      {#if fetchStatus !== null}
        <span class="pb-2 text-xs text-muted-foreground">{fetchStatus}</span>
      {/if}
    </form>
  </div>

  {#if picking}
    <!-- The picker takes over the content area (rather than stacking above) so it gets full height
         and doesn't squeeze the lists below it. -->
    <HeroPicker
      onConfirm={confirmManual}
      onCancel={() => (picking = false)}
      disabledHeroIds={fearlessSeries.bannedHeroIds}
    />
  {:else}
    <div class="flex min-h-0 flex-1 gap-4 max-lg:flex-col max-lg:overflow-y-auto">
      <!-- Watched games to pick from -->
      <div class="flex min-h-0 flex-1 flex-col rounded-lg border bg-card p-4 shadow-sm">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Watched games
          </span>
          <span class="text-xs text-muted-foreground">{fearlessSeries.watchedGames.length}</span>
        </div>

        <div class="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto rounded-md border">
          {#if fearlessSeries.watchedGames.length === 0}
            <div class="px-3 py-6 text-center text-sm text-muted-foreground">
              No watched games yet. Spectate a game or fetch one by match ID.
            </div>
          {:else}
            {#each fearlessSeries.watchedGames as game (game.matchId)}
              {@const inSeries = fearlessSeries.isInSeries(game.matchId)}
              <div class="flex flex-col gap-2 px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <div class="flex min-w-0 flex-1 flex-col">
                    {#if teamsLabel(game) !== null}
                      <span class="truncate text-sm font-medium">{teamsLabel(game)}</span>
                      <span class="truncate font-mono text-xs text-muted-foreground">
                        {game.matchId} · {capturedLabel(game)}
                      </span>
                    {:else if hasPlayerNames(game)}
                      <span class="truncate text-sm">{radiantNames(game)}</span>
                      <span class="truncate text-sm">vs {direNames(game)}</span>
                      <span class="truncate font-mono text-[11px] text-muted-foreground">
                        {game.matchId} · {capturedLabel(game)}
                      </span>
                    {:else}
                      <span class="truncate font-mono text-sm font-medium">{game.matchId}</span>
                      <span class="text-xs text-muted-foreground">{capturedLabel(game)}</span>
                    {/if}
                  </div>
                  <Button
                    size="sm"
                    variant={inSeries ? 'ghost' : 'outline'}
                    disabled={inSeries}
                    onclick={() => fearlessSeries.addToSeries(game)}
                  >
                    {#if inSeries}
                      In series
                    {:else}
                      <PlusIcon />
                      Add
                    {/if}
                  </Button>
                </div>
                <HeroIcons heroIds={game.heroIds} width={44} labels={game.playerNames ?? []} />
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Current series + resulting ban pool -->
      <div class="flex min-h-0 flex-1 flex-col rounded-lg border bg-card p-4 shadow-sm">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Current series
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={fearlessSeries.series.length === 0}
            onclick={() => fearlessSeries.clearSeries()}
          >
            Clear series
          </Button>
        </div>

        <div class="mb-3 flex flex-col divide-y rounded-md border">
          {#if fearlessSeries.series.length === 0}
            <div class="px-3 py-6 text-center text-sm text-muted-foreground">
              No games in the series. Add a watched game to start banning its heroes.
            </div>
          {:else}
            {#each fearlessSeries.series as game, index (game.matchId)}
              <div class="flex items-center gap-2 px-3 py-2">
                <span class="w-12 shrink-0 text-xs text-muted-foreground">Game {index + 1}</span>
                <span class="min-w-0 flex-1 truncate text-sm">{game.label}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onclick={() => fearlessSeries.removeFromSeries(game.matchId)}
                  aria-label="Remove {game.label} from series"
                >
                  <TrashIcon />
                </Button>
              </div>
            {/each}
          {/if}
        </div>

        <div class="flex min-h-0 flex-1 flex-col">
          <span class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Banned heroes ({fearlessSeries.bannedHeroIds.length})
          </span>
          <div class="min-h-0 flex-1 overflow-y-auto">
            {#if fearlessSeries.bannedHeroIds.length === 0}
              <p class="text-sm text-muted-foreground">No heroes banned yet.</p>
            {:else}
              <HeroIcons heroIds={fearlessSeries.bannedHeroIds} width={56} />
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
