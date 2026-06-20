<script lang="ts">
  import { onMount } from 'svelte';

  import { SELECTED_PLAYER_ID } from '../shared/componentOptions.js';
  import {
    FEARLESS_DRAFT_ID,
    OVERLAY_ELEMENT_DEFINITIONS
  } from '../shared/overlayElementCatalog.js';
  import ComponentMenu from '$lib/components/component-menu.svelte';
  import ComponentSettingsPanel from '$lib/components/component-settings.svelte';
  import OverlayPreview from '$lib/components/overlay-preview.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { SAMPLE_BANNED_HERO_IDS, SAMPLE_DRAFT_GSI_DATA } from '$lib/dev/sampleGsiData.js';
  import { GsiFeed } from '$lib/gsiFeed.svelte.js';
  import { knownPlayers } from '$lib/state/knownPlayers.svelte.js';
  import { overlayConfig } from '$lib/state/overlayConfig.svelte.js';
  import { previewBackground } from '$lib/state/previewBackground.svelte.js';
  import { previewGameState, type PreviewGameState } from '$lib/state/previewGameState.svelte.js';
  import { previewSource } from '$lib/state/previewSource.svelte.js';

  let selectedId = $state<string | undefined>(OVERLAY_ELEMENT_DEFINITIONS[0]?.id);

  // Game-state-specific overlays the preview can show. Extend this as more state-specific elements
  // are added (e.g. post-game).
  const PREVIEW_GAME_STATES: { value: PreviewGameState; label: string }[] = [
    { value: 'in-progress', label: 'In-game' },
    { value: 'draft', label: 'Draft' }
  ];
  let previewGameStateLabel = $derived(
    PREVIEW_GAME_STATES.find((state) => state.value === previewGameState.value)?.label ?? 'In-game'
  );

  // The game state each component is shown in, so selecting a component jumps the preview to where
  // that component is actually visible.
  const COMPONENT_PREVIEW_STATE: Record<string, PreviewGameState> = {
    [SELECTED_PLAYER_ID]: 'in-progress',
    [FEARLESS_DRAFT_ID]: 'draft'
  };

  function syncPreviewStateToComponent(id: string): void {
    const state = COMPONENT_PREVIEW_STATE[id];
    if (state !== undefined) {
      previewGameState.value = state;
    }
  }

  // Sample (static, always available) vs. live game feed. In live mode the preview shows the
  // real GSI payload, or a "waiting" hint (null) when no fresh feed is arriving. The selection
  // lives in a shared store so it persists across navigation.
  const feed = new GsiFeed();
  onMount(() => feed.start());

  // In Sample mode the game-state selector picks which game-state-specific overlay to show (the
  // in-game readout or the draft grid). In Live mode the real feed's game_state drives it instead.
  // undefined falls back to the in-progress sample inside OverlayPreview.
  let previewData = $derived.by(() => {
    if (previewSource.live) {
      return feed.data;
    }
    return previewGameState.draft ? SAMPLE_DRAFT_GSI_DATA : undefined;
  });
  // Ranks only apply in live mode; the sample snapshot supplies its own inside OverlayPreview.
  let previewRanks = $derived(previewSource.live ? feed.ranks : []);
  // Ban pool for the draft grid: live pool over SSE, or the sample pool when previewing the draft.
  let previewBannedHeroIds = $derived.by(() => {
    if (previewSource.live) {
      return feed.fearlessBannedHeroIds;
    }
    return previewGameState.draft ? [...SAMPLE_BANNED_HERO_IDS] : [];
  });

  let selectedName = $derived(
    OVERLAY_ELEMENT_DEFINITIONS.find((element) => element.id === selectedId)?.name
  );

  function resetSelected(): void {
    if (selectedId !== undefined) {
      overlayConfig.resetComponent(selectedId);
    }
  }
</script>

<svelte:head>
  <title>Overlay | Observer Studio</title>
  <meta content="Live preview of the Dota Observer Studio overlay." name="description" />
</svelte:head>

<section class="flex h-full min-h-0 gap-3 px-6 py-4 max-sm:gap-2 max-sm:px-4">
  <div class="flex min-h-0 w-64 shrink-0 flex-col gap-3">
    <ComponentMenu
      enabled={overlayConfig.enabled}
      bind:selectedId
      onSelect={syncPreviewStateToComponent}
    />
    {#if selectedId === undefined}
      <ComponentSettingsPanel />
    {:else}
      <ComponentSettingsPanel
        name={selectedName}
        bind:settings={overlayConfig.settings[selectedId]}
        onReset={resetSelected}
      />
    {/if}
  </div>

  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
    <div class="flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4">
      <span class="text-base font-semibold">Preview</span>

      <div class="flex items-center gap-6">
        <!-- Which game-state-specific overlay to preview. Drives the Sample data; in Live mode the
             real feed's game_state decides, so the selector is disabled there. -->
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-muted-foreground">Game state</span>
          <Select.Root
            type="single"
            disabled={previewSource.live}
            value={previewGameState.value}
            onValueChange={(value) => (previewGameState.value = value as PreviewGameState)}
          >
            <Select.Trigger class="w-28">
              <span class="min-w-0 flex-1 truncate text-left">{previewGameStateLabel}</span>
            </Select.Trigger>
            <Select.Content>
              {#each PREVIEW_GAME_STATES as state (state.value)}
                <Select.Item value={state.value} label={state.label}>{state.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="inline-flex items-center rounded-lg border bg-muted p-0.5 text-sm">
          <Label class="gap-2 px-3 py-1 font-medium leading-5 text-muted-foreground">
            <Checkbox bind:checked={previewBackground.inGame} />
            In-game background
          </Label>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-muted-foreground">Source</span>
          <div
            class="inline-flex items-center gap-0.5 rounded-lg border bg-muted p-0.5 text-sm"
            role="group"
            aria-label="Preview source"
          >
            <button
              type="button"
              class="rounded-md px-3 py-1 font-medium transition-colors {!previewSource.live
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'}"
              aria-pressed={!previewSource.live}
              onclick={() => (previewSource.live = false)}
            >
              Sample
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1 font-medium transition-colors {previewSource.live
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'}"
              aria-pressed={previewSource.live}
              onclick={() => (previewSource.live = true)}
            >
              Live
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-1 p-4">
      <OverlayPreview
        gsiData={previewData}
        ranks={previewRanks}
        knownPlayers={knownPlayers.players}
        fearlessBannedHeroIds={previewBannedHeroIds}
        enabled={overlayConfig.enabled}
        settings={overlayConfig.settings}
        options={overlayConfig.options}
        background={previewBackground.inGame ? 'ingame' : 'checkerboard'}
      />
    </div>
  </div>
</section>
