<script lang="ts">
  import InfoIcon from '@lucide/svelte/icons/info';

  import * as Select from '$lib/components/ui/select/index.js';
  import { Switch } from '$lib/components/ui/switch/index.js';
  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import {
    NAME_SOURCE_LABELS,
    type PlayerNameSource,
    type SelectedPlayerOptions
  } from '../../shared/componentOptions.js';

  let { options = $bindable() }: { options?: SelectedPlayerOptions | undefined } = $props();
</script>

{#if options}
  {@const ingame = options.nameSource === 'ingame'}
  <Tooltip.Provider delayDuration={200}>
    <div class="rounded-lg border bg-card p-4 shadow-sm">
      <div class="mb-3 flex items-center gap-1.5">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</span
        >
      </div>

      <div class="flex flex-col divide-y">
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

        <div class="flex items-center justify-between gap-4 pt-3">
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-sm font-medium">Source</span>
            <span class="text-xs text-muted-foreground">
              Known names come from the known-players list and fall back to the in-game name.
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
                {NAME_SOURCE_LABELS.profile}
              </Select.Item>
              <Select.Item value="ingame" label={NAME_SOURCE_LABELS.ingame}>
                {NAME_SOURCE_LABELS.ingame}
              </Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
      </div>
    </div>

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

        <div class="flex items-center justify-between gap-4 pt-3 {ingame ? 'opacity-60' : ''}">
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-sm font-medium">MMR</span>
            <span class="text-xs text-muted-foreground"
              >Show the player's MMR next to the medal.</span
            >
          </div>
          <Switch
            class="shrink-0"
            disabled={ingame}
            checked={!ingame && options.rankValue === 'mmr'}
            onCheckedChange={(checked) => {
              if (options) {
                options.rankValue = checked ? 'mmr' : 'hidden';
              }
            }}
          />
        </div>
      </div>
    </div>
  </Tooltip.Provider>
{/if}
