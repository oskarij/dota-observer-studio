<script lang="ts">
  import InfoIcon from '@lucide/svelte/icons/info';

  import * as Select from '$lib/components/ui/select/index.js';
  import { Switch } from '$lib/components/ui/switch/index.js';
  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import type {
    PlayerNameSource,
    RankValueDisplay,
    SelectedPlayerOptions
  } from '../../shared/componentOptions.js';

  // Bindable + optional to match the dynamic-index bind on the Components page (the indexed
  // lookup is ComponentOptions | undefined under noUncheckedIndexedAccess).
  let { options = $bindable() }: { options?: SelectedPlayerOptions | undefined } = $props();

  const NAME_SOURCE_LABELS: Record<PlayerNameSource, string> = {
    ingame: 'In-game name',
    profile: 'Known name'
  };
  const RANK_VALUE_LABELS: Record<RankValueDisplay, string> = {
    hidden: 'Hidden',
    mmr: 'MMR'
  };
</script>

{#if options}
  <!-- In-game mode treats the player as live/unknown: the medal is pulled from OpenDota (real, but
       only as fresh as its last refresh, and missing for private profiles) and MMR isn't public,
       so the rank value is disabled in that mode. -->
  {@const ingame = options.nameSource === 'ingame'}
  <Tooltip.Provider delayDuration={200}>
    <!-- Name (show + source) -->
    <div class="rounded-lg border bg-card p-4 shadow-sm">
      <div class="mb-3 flex items-center gap-1.5">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</span
        >
      </div>

      <div class="flex flex-col divide-y">
        <!-- Show -->
        <div class="flex items-center justify-between gap-4 pb-3">
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-sm font-medium">Name</span>
            <span class="text-xs text-muted-foreground">Show the player's name.</span>
          </div>
          <Switch
            class="shrink-0"
            checked={options.showName}
            onCheckedChange={(checked) => {
              if (options) {
                options.showName = checked;
              }
            }}
          />
        </div>

        <!-- Source — also drives the medal source in in-game mode, so it stays active even when
             the name itself is hidden. -->
        <div class="flex items-center justify-between gap-4 pt-3">
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-sm font-medium">Source</span>
            <span class="text-xs text-muted-foreground">
              Use local list of player names, or pull the current in-game name.
            </span>
          </div>
          <Select.Root
            type="single"
            value={options.nameSource}
            onValueChange={(value) => {
              if (options) {
                options.nameSource = value as PlayerNameSource;
              }
            }}
          >
            <Select.Trigger class="w-40 shrink-0">
              <span class="min-w-0 flex-1 truncate text-left">
                {NAME_SOURCE_LABELS[options.nameSource]}
              </span>
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="profile" label={NAME_SOURCE_LABELS.profile}>
                Known name (fallback to in-game)
              </Select.Item>
              <Select.Item value="ingame" label={NAME_SOURCE_LABELS.ingame}
                >In-game name</Select.Item
              >
            </Select.Content>
          </Select.Root>
        </div>
      </div>
    </div>

    <!-- Rank (medal + value) -->
    <div class="rounded-lg border bg-card p-4 shadow-sm">
      <div class="mb-3 flex items-center gap-1.5">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rank</span
        >
        {#if ingame}
          <Tooltip.Root>
            <Tooltip.Trigger
              class="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Rank data source"
            >
              <InfoIcon class="size-3.5" />
            </Tooltip.Trigger>
            <Tooltip.Content>
              In-game mode pulls the medal from OpenDota and it may be out of date, or unavailable
              if the player's profile is private. MMR isn't public, so it can't be shown.
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}
      </div>

      <div class="flex flex-col divide-y">
        <!-- Medal -->
        <div class="flex items-center justify-between gap-4 pb-3">
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-sm font-medium">Medal</span>
            <span class="text-xs text-muted-foreground">Show the rank medal icon.</span>
          </div>
          <Switch
            class="shrink-0"
            checked={options.showMedal}
            onCheckedChange={(checked) => {
              if (options) {
                options.showMedal = checked;
              }
            }}
          />
        </div>

        <!-- Value -->
        <div class="flex items-center justify-between gap-4 pt-3 {ingame ? 'opacity-60' : ''}">
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-sm font-medium">Value</span>
            <span class="text-xs text-muted-foreground"
              >Show MMR next to the medal, or hide it.</span
            >
          </div>
          {#if ingame}
            <div
              class="flex h-8 w-40 shrink-0 cursor-not-allowed items-center rounded-lg border border-input px-2.5 text-sm text-muted-foreground"
            >
              Unavailable
            </div>
          {:else}
            <Select.Root
              type="single"
              value={options.rankValue}
              onValueChange={(value) => {
                if (options) {
                  options.rankValue = value as RankValueDisplay;
                }
              }}
            >
              <Select.Trigger class="w-40 shrink-0">
                <span class="min-w-0 flex-1 truncate text-left">
                  {RANK_VALUE_LABELS[options.rankValue]}
                </span>
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="mmr" label={RANK_VALUE_LABELS.mmr}>MMR</Select.Item>
                <Select.Item value="hidden" label={RANK_VALUE_LABELS.hidden}>Hidden</Select.Item>
              </Select.Content>
            </Select.Root>
          {/if}
        </div>
      </div>
    </div>
  </Tooltip.Provider>
{/if}
