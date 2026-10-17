<script lang="ts">
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import MinusIcon from '@lucide/svelte/icons/minus';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash-2';

  import HeroIcons from '$lib/components/hero-icons.svelte';
  import HeroPicker from '$lib/components/hero-picker.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { fearlessSeries } from '$lib/state/fearlessSeries.svelte.js';
  import { knownPlayers } from '$lib/state/knownPlayers.svelte.js';
  import { seriesState } from '$lib/state/seriesState.svelte.js';
  import { NO_TEAM_VALUE, teams } from '$lib/state/teams.svelte.js';
  import type { WatchedGame } from '../../shared/fearlessDraft.js';
  import type { Side } from '../../shared/seriesState.js';
  import { linksBothTeams, teamIdByAccount } from '../../shared/teamMatching.js';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let pickingRevision = $state<number | null>(null);
  let matchIdInput = $state('');
  let fetching = $state(false);
  let status = $state<string | null>(null);

  let snapshot = $derived(seriesState.snapshot);
  let canFetch = $derived(/^\d+$/.test(matchIdInput.trim()) && !fetching);

  const RECENT_LIMIT = 6;
  let recentGames = $derived(
    [...fearlessSeries.watchedGames]
      .sort((a, b) => b.capturedAt - a.capturedAt)
      .slice(0, RECENT_LIMIT)
  );

  let byAccount = $derived(teamIdByAccount(knownPlayers.players));
  function isThisSeries(game: WatchedGame): boolean {
    const radiant = snapshot?.sides.radiant?.teamId ?? null;
    const dire = snapshot?.sides.dire?.teamId ?? null;
    if (radiant === null || dire === null || game.accountIds === undefined) {
      return false;
    }
    return linksBothTeams(game.accountIds, byAccount, radiant, dire);
  }

  function gameLabel(game: WatchedGame): string {
    if (game.radiantTeam !== undefined && game.direTeam !== undefined) {
      return `${game.radiantTeam} vs ${game.direTeam}`;
    }
    const names = (game.playerNames ?? []).filter((name) => name !== '');
    return names.length > 0 ? names.slice(0, 3).join(', ') : `Match ${game.matchId}`;
  }

  function setTeam(side: Side, value: string): void {
    void seriesState.setTeam(side, value === NO_TEAM_VALUE ? null : value);
  }

  function sideLabel(side: Side): string {
    return snapshot?.sides[side]?.name ?? (side === 'radiant' ? 'Radiant' : 'Dire');
  }

  async function fetchMatch(): Promise<void> {
    if (!canFetch) {
      return;
    }

    const submittedId = matchIdInput.trim();
    const revision = fearlessSeries.revision;
    fetching = true;
    status = null;
    try {
      const result = await fearlessSeries.fetchMatch(submittedId);
      if (!result.ok) {
        status = result.reason;
        return;
      }
      if (
        (await fearlessSeries.addToSeries(result.game, revision)) &&
        matchIdInput.trim() === submittedId
      )
        matchIdInput = '';
    } finally {
      fetching = false;
    }
  }
</script>

<div class="rounded-lg border bg-card shadow-sm">
  <button
    type="button"
    class="flex w-full items-center gap-2 px-4 py-3 text-left"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <ChevronRightIcon
      class="size-4 shrink-0 text-muted-foreground transition-transform {open ? 'rotate-90' : ''}"
    />
    <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Manual controls
    </span>
  </button>

  {#if seriesState.error}<p role="alert" class="px-4 text-xs text-destructive">
      {seriesState.error}
    </p>{/if}
  {#if open && snapshot !== null}
    {#if pickingRevision !== null}
      <div class="flex h-[34rem] flex-col border-t p-4">
        <HeroPicker
          onConfirm={async (heroIds) => {
            if (
              pickingRevision !== null &&
              (await fearlessSeries.addManualSeriesGame(heroIds, pickingRevision))
            )
              pickingRevision = null;
          }}
          onCancel={() => (pickingRevision = null)}
          pending={fearlessSeries.pending > 0}
          disabledHeroIds={fearlessSeries.bannedHeroIds}
        />
      </div>
    {:else}
      <div class="flex flex-col gap-4 border-t p-4">
        <div class="flex flex-col gap-2">
          {#if snapshot.mode === 'ticket'}
            <p class="text-xs text-muted-foreground">
              Teams and sides come from the league ticket. Fix a team's name or logo on Teams &amp;
              Players.
            </p>
          {/if}
          {#each ['radiant', 'dire'] as const as side (side)}
            <div class="flex items-center gap-3">
              {#if snapshot.mode === 'manual'}
                <Select.Root
                  type="single"
                  value={snapshot.manual[side] ?? NO_TEAM_VALUE}
                  onValueChange={(value) => setTeam(side, value)}
                >
                  <Select.Trigger
                    class="w-56"
                    aria-label="{side === 'radiant' ? 'Radiant' : 'Dire'} team"
                  >
                    <span class="min-w-0 flex-1 truncate text-left">
                      {teams.byId(snapshot.manual[side])?.name ?? 'Pick team…'}
                    </span>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={NO_TEAM_VALUE} label="No team">No team</Select.Item>
                    {#each teams.teams as candidate (candidate.id)}
                      <Select.Item value={candidate.id} label={candidate.name}>
                        {candidate.name}
                      </Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              {:else}
                <span class="w-56 truncate text-sm font-medium">{sideLabel(side)}</span>
              {/if}

              <div class="ml-auto flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={(snapshot.sides[side]?.score ?? 0) === 0}
                  aria-label="Decrease score for {sideLabel(side)}"
                  onclick={() => void seriesState.adjustScore(side, -1)}
                >
                  <MinusIcon />
                </Button>
                <span class="w-8 text-center text-lg font-semibold tabular-nums">
                  {snapshot.sides[side]?.score ?? 0}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={snapshot.sides[side] === null}
                  aria-label="Increase score for {sideLabel(side)}"
                  onclick={() => void seriesState.adjustScore(side, 1)}
                >
                  <PlusIcon />
                </Button>
              </div>
            </div>
          {/each}
          {#if snapshot.scoreSource === 'manual'}
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-muted-foreground">Score set manually for this series.</span>
              <Button
                size="xs"
                variant="ghost"
                onclick={() => void seriesState.useAutomaticScore()}
              >
                Use automatic score
              </Button>
            </div>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Games
          </span>

          {#if fearlessSeries.series.length > 0}
            <div class="flex flex-col divide-y rounded-md border">
              {#each fearlessSeries.series as game, index (game.matchId)}
                <div class="flex items-center gap-3 px-3 py-1.5">
                  <span class="w-10 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                  <span class="w-40 shrink-0 truncate text-sm">{game.label}</span>
                  <div class="min-w-0 flex-1">
                    <HeroIcons heroIds={game.heroIds} width={28} scroll />
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove {game.label}"
                    onclick={() => fearlessSeries.removeFromSeries(game.matchId)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              {/each}
            </div>
          {/if}

          <form
            class="flex items-center gap-2"
            onsubmit={(event) => {
              event.preventDefault();
              void fetchMatch();
            }}
          >
            <Input
              class="h-8 w-40"
              bind:value={matchIdInput}
              placeholder="Match ID"
              inputmode="numeric"
              aria-label="Match ID to add"
            />
            <Button type="submit" size="sm" disabled={!canFetch}>
              {fetching ? 'Adding…' : 'Add game'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onclick={() => {
                status = null;
                fearlessSeries.error = null;
                pickingRevision = fearlessSeries.revision;
              }}
            >
              Pick heroes
            </Button>
            {#if fearlessSeries.series.length > 0}
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onclick={() => fearlessSeries.clearSeries()}
              >
                Clear
              </Button>
            {/if}
          </form>

          {#if fearlessSeries.manualOverride}
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-muted-foreground">Picks set manually for this series.</span>
              <Button
                size="xs"
                variant="ghost"
                onclick={() => void fearlessSeries.useAutomaticSeries()}
              >
                Use automatic picks
              </Button>
            </div>
          {/if}
        </div>

        {#if recentGames.length > 0}
          <div class="flex flex-col gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent games
            </span>
            <div class="flex flex-col divide-y rounded-md border">
              {#each recentGames as game (game.matchId)}
                {@const inSeries = fearlessSeries.isInSeries(game.matchId)}
                <div class="flex items-center gap-3 px-3 py-1.5">
                  <span class="w-40 shrink-0 truncate text-sm">{gameLabel(game)}</span>
                  {#if isThisSeries(game)}
                    <span
                      class="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                    >
                      This series
                    </span>
                  {/if}
                  <div class="min-w-0 flex-1">
                    <HeroIcons heroIds={game.heroIds} width={28} scroll />
                  </div>
                  <Button
                    size="xs"
                    variant={inSeries ? 'ghost' : 'outline'}
                    disabled={inSeries}
                    onclick={() => fearlessSeries.addToSeries(game)}
                  >
                    {inSeries ? 'Added' : 'Add'}
                  </Button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="flex flex-wrap items-center gap-2 border-t pt-3">
          {#if snapshot.mode === 'manual'}
            <Button size="sm" variant="outline" onclick={() => void seriesState.swapSides()}>
              <ArrowLeftRightIcon />
              Swap sides
            </Button>
          {/if}

          <Button
            class="ml-auto"
            size="xs"
            variant="ghost"
            onclick={() => void seriesState.resetScores()}
          >
            Reset scores
          </Button>
        </div>
      </div>
    {/if}
    {#if status !== null || fearlessSeries.error !== null}
      <p role="alert" class="px-4 pb-4 text-xs text-destructive">
        {status ?? fearlessSeries.error}
      </p>
    {/if}
  {/if}
</div>
