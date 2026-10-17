<script lang="ts">
  import ImageIcon from '@lucide/svelte/icons/image';

  import HeroIcons from '$lib/components/hero-icons.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { fearlessSeries } from '$lib/state/fearlessSeries.svelte.js';
  import { seriesState } from '$lib/state/seriesState.svelte.js';
  import { tournament } from '$lib/state/tournament.svelte.js';
  import type { SeriesScoreSource, Side } from '../../shared/seriesState.js';

  let { onSetUpManually }: { onSetUpManually: () => void } = $props();

  const SCORE_SOURCES: Record<SeriesScoreSource, string> = {
    manual: 'score set manually',
    ticket: 'score from the ticket',
    history: 'score from Valve match history',
    count: 'score counted from spectated games'
  };

  let snapshot = $derived(seriesState.snapshot);
  let historySeries = $derived(tournament.series);
  let bestOf = $derived(historySeries?.bestOf ?? null);
  let hasSeries = $derived(
    snapshot !== null && (snapshot.sides.radiant !== null || snapshot.sides.dire !== null)
  );

  function viewFor(side: Side) {
    const view = snapshot?.sides[side] ?? null;
    return {
      name: view?.name ?? 'No team',
      logoPath: view?.logoPath ?? null,
      score: view?.score ?? 0
    };
  }

  let games = $derived.by(() => {
    if (historySeries !== null && !fearlessSeries.manualOverride) {
      return historySeries.games.map((game) => ({
        key: game.matchId,
        label:
          historySeries.teams.find((team) => team.teamId === game.winnerTeamId)?.name ?? 'Unknown',
        heroIds: game.heroIds
      }));
    }
    return fearlessSeries.series.map((game) => ({
      key: game.matchId,
      label: game.label,
      heroIds: game.heroIds
    }));
  });
</script>

<div class="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
  <div class="flex items-center justify-between gap-2">
    <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Current series
    </span>
    {#if bestOf !== null}
      <span class="text-xs text-muted-foreground">Bo{bestOf}</span>
    {/if}
  </div>

  {#if snapshot === null}
    <p class="text-sm text-muted-foreground">Loading…</p>
  {:else if !hasSeries}
    <div class="flex flex-col items-center gap-3 py-8">
      <p class="text-sm text-muted-foreground">
        No league game detected. Spectate a ticketed lobby, or set the series yourself.
      </p>
      <Button size="sm" variant="outline" onclick={onSetUpManually}>Set up manually</Button>
    </div>
  {:else}
    <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      {#snippet teamSide(side: Side, mirrored: boolean)}
        {@const view = viewFor(side)}
        <div class="flex items-center gap-3 {mirrored ? 'flex-row-reverse text-right' : ''}">
          {#if view.logoPath !== null}
            <img src={view.logoPath} alt="" class="size-14 shrink-0 rounded object-contain" />
          {:else}
            <div
              class="flex size-14 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground"
            >
              <ImageIcon class="size-5" />
            </div>
          {/if}
          <div class="flex min-w-0 flex-col gap-0.5 {mirrored ? 'items-end' : 'items-start'}">
            <span class="truncate text-lg font-semibold">{view.name}</span>
            <span
              class="text-xs font-medium {side === 'radiant'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'}"
            >
              {side === 'radiant' ? 'Radiant' : 'Dire'}
            </span>
          </div>
        </div>
      {/snippet}

      {@render teamSide('radiant', false)}

      <div class="flex items-center gap-2 text-4xl font-bold tabular-nums">
        <span>{viewFor('radiant').score}</span>
        <span class="text-muted-foreground">–</span>
        <span>{viewFor('dire').score}</span>
      </div>

      {@render teamSide('dire', true)}
    </div>

    {#if snapshot !== null}
      <p class="text-xs text-muted-foreground">
        {snapshot.mode === 'ticket' ? 'Teams from the league ticket' : 'Teams set manually'},
        {SCORE_SOURCES[snapshot.scoreSource]}.
      </p>
    {/if}

    {#if games.length > 0}
      <div class="flex flex-col divide-y rounded-md border">
        {#each games as game, index (game.key)}
          <div class="flex items-center gap-3 px-3 py-2">
            <span class="w-14 shrink-0 text-xs text-muted-foreground">Game {index + 1}</span>
            <span class="w-40 shrink-0 truncate text-sm">{game.label}</span>
            {#if game.heroIds.length > 0}
              <div class="min-w-0 flex-1">
                <HeroIcons heroIds={game.heroIds} width={34} scroll />
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if fearlessSeries.bannedHeroIds.length > 0}
      <div class="flex flex-col gap-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fearless bans ({fearlessSeries.bannedHeroIds.length})
        </span>
        <HeroIcons heroIds={fearlessSeries.bannedHeroIds} width={44} />
      </div>
    {/if}
  {/if}
</div>
