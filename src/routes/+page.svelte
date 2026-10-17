<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import CopyIcon from '@lucide/svelte/icons/copy';

  import { SELECTED_PLAYER_ID, isTeamNameId, isPlayerNamesId } from '../shared/componentOptions.js';
  import {
    DRAFT_BOARD_ID,
    OVERLAY_MENU_ENTRIES,
    type OverlayPhase
  } from '../shared/overlayElementCatalog.js';
  import ComponentMenu from '$lib/components/component-menu.svelte';
  import ComponentSettingsPanel from '$lib/components/component-settings.svelte';
  import CustomCssEditor from '$lib/components/custom-css-editor.svelte';
  import DraftBoardOptionsForm from '$lib/components/draft-board-options.svelte';
  import TeamNameOptionsForm from '$lib/components/team-name-options.svelte';
  import PlayerNamesOptionsForm from '$lib/components/player-names-options.svelte';
  import OverlayPreview from '$lib/components/overlay-preview.svelte';
  import SelectedPlayerOptionsForm from '$lib/components/selected-player-options.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import {
    SAMPLE_BANNED_HERO_IDS,
    SAMPLE_DRAFT_GSI_DATA,
    SAMPLE_SERIES_STATE
  } from '$lib/dev/sampleGsiData.js';
  import { GsiFeed } from '$lib/gsiFeed.svelte.js';
  import { knownPlayers } from '$lib/state/knownPlayers.svelte.js';
  import { network } from '$lib/state/network.svelte.js';
  import { overlayConfig } from '$lib/state/overlayConfig.svelte.js';
  import { previewBackground } from '$lib/state/previewBackground.svelte.js';
  import { previewGameState, type PreviewGameState } from '$lib/state/previewGameState.svelte.js';
  import { previewSource } from '$lib/state/previewSource.svelte.js';

  let selectedKey = $state<string | undefined>(OVERLAY_MENU_ENTRIES[0]?.key);

  let activeMemberId = $state<string | undefined>();

  let preview = $state<OverlayPreview | undefined>(undefined);

  const PHASE_TABS: { value: PreviewGameState; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'in-progress', label: 'In-game' }
  ];

  // Custom CSS spans every element in both scenes, so it has its own view beside the components.
  let view = $state<'components' | 'css'>('components');
  const VIEW_TABS = [
    { value: 'components', label: 'Components' },
    { value: 'css', label: 'Custom CSS' }
  ] as const;

  let phase = $derived<OverlayPhase>(previewGameState.draft ? 'draft' : 'ingame');
  let phaseEntries = $derived(OVERLAY_MENU_ENTRIES.filter((entry) => entry.phase === phase));

  let sceneUrl = $derived(network.info?.overlayUrls[phase] ?? null);
  let sceneUrlCopied = $state(false);
  let sceneUrlCopiedTimer: ReturnType<typeof globalThis.setTimeout> | undefined = undefined;

  async function copySceneUrl(): Promise<void> {
    if (sceneUrl === null) {
      return;
    }

    await globalThis.navigator.clipboard.writeText(sceneUrl);
    sceneUrlCopied = true;
    globalThis.clearTimeout(sceneUrlCopiedTimer);
    sceneUrlCopiedTimer = globalThis.setTimeout(() => {
      sceneUrlCopied = false;
    }, 1500);
  }

  $effect(() => {
    if (!phaseEntries.some((entry) => entry.key === selectedKey)) {
      selectedKey = phaseEntries[0]?.key;
    }
  });

  let selectedEntry = $derived(OVERLAY_MENU_ENTRIES.find((entry) => entry.key === selectedKey));

  $effect(() => {
    if (!selectedEntry?.members.some((member) => member.id === activeMemberId)) {
      activeMemberId = selectedEntry?.members[0]?.id;
    }
  });

  const feed = new GsiFeed();
  $effect(() => {
    return previewSource.live ? feed.start() : undefined;
  });

  let previewData = $derived.by(() => {
    if (previewSource.live) {
      return feed.data;
    }
    return previewGameState.draft ? SAMPLE_DRAFT_GSI_DATA : undefined;
  });

  let previewRanks = $derived(previewSource.live ? feed.ranks : []);

  let previewBannedHeroIds = $derived.by(() => {
    if (previewSource.live) {
      return feed.fearlessBannedHeroIds;
    }
    return previewGameState.draft ? [...SAMPLE_BANNED_HERO_IDS] : [];
  });

  let previewSeriesState = $derived(previewSource.live ? feed.seriesState : SAMPLE_SERIES_STATE);

  function resetSelected(): void {
    if (activeMemberId !== undefined) {
      overlayConfig.resetComponent(activeMemberId);
    }
  }
</script>

<svelte:head>
  <title>Overlay | Observer Studio</title>
  <meta content="Live preview of the Dota Observer Studio overlay." name="description" />
</svelte:head>

<section class="flex h-full min-h-0 gap-3 px-6 py-4 max-sm:gap-2 max-sm:px-4">
  <div class="flex min-h-0 w-80 shrink-0 flex-col gap-3">
    <div
      class="inline-flex shrink-0 items-center gap-0.5 rounded-lg border bg-muted p-0.5 text-sm"
      role="group"
      aria-label="Overlay editor"
    >
      {#each VIEW_TABS as tab (tab.value)}
        {@const active = view === tab.value}
        <button
          type="button"
          class="flex-1 rounded-md px-3 py-1 font-medium transition-colors {active
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'}"
          aria-pressed={active}
          onclick={() => (view = tab.value)}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    {#if view === 'css'}
      <CustomCssEditor bind:css={overlayConfig.customCss} />
    {:else}
      <div class="shrink-0">
        <ComponentMenu entries={phaseEntries} enabled={overlayConfig.enabled} bind:selectedKey />
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {#if activeMemberId === undefined}
          <ComponentSettingsPanel />
        {:else}
          <ComponentSettingsPanel
            name={selectedEntry?.menuLabel}
            tabs={selectedEntry !== undefined && selectedEntry.members.length > 1
              ? selectedEntry.members.map((member) => ({ value: member.id, label: member.label }))
              : undefined}
            activeTab={activeMemberId}
            onTabChange={(value) => (activeMemberId = value)}
            elementId={activeMemberId}
            bind:settings={overlayConfig.settings[activeMemberId]}
            measure={(id) => preview?.measureElement(id) ?? null}
            onReset={resetSelected}
          >
            {#if activeMemberId === DRAFT_BOARD_ID}
              <DraftBoardOptionsForm bind:options={overlayConfig.options[DRAFT_BOARD_ID]} />
            {:else if isPlayerNamesId(activeMemberId)}
              <PlayerNamesOptionsForm bind:options={overlayConfig.options[activeMemberId]} />
            {:else if isTeamNameId(activeMemberId)}
              <TeamNameOptionsForm bind:options={overlayConfig.options[activeMemberId]} />
            {/if}
          </ComponentSettingsPanel>
          {#if selectedKey === SELECTED_PLAYER_ID}
            <SelectedPlayerOptionsForm bind:options={overlayConfig.options[SELECTED_PLAYER_ID]} />
          {/if}
        {/if}
      </div>
    {/if}
  </div>

  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
    <div class="flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4">
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="inline-flex shrink-0 items-center gap-0.5 rounded-lg border bg-muted p-0.5 text-sm"
          role="group"
          aria-label="Overlay scene"
        >
          {#each PHASE_TABS as tab (tab.value)}
            {@const active = previewGameState.value === tab.value}
            <button
              type="button"
              class="rounded-md px-3 py-1 font-medium transition-colors {active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'}"
              aria-pressed={active}
              onclick={() => (previewGameState.value = tab.value)}
            >
              {tab.label}
            </button>
          {/each}
        </div>

        {#if sceneUrl !== null}
          <div class="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <span class="min-w-0 truncate font-mono" title={sceneUrl}>{sceneUrl}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              class="shrink-0"
              aria-label={sceneUrlCopied ? 'Copied' : 'Copy browser source URL'}
              onclick={copySceneUrl}
            >
              {#if sceneUrlCopied}
                <CheckIcon />
              {:else}
                <CopyIcon />
              {/if}
            </Button>
          </div>
        {/if}
      </div>

      <div class="flex shrink-0 items-center gap-6">
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
        bind:this={preview}
        {phase}
        gsiData={previewData}
        ranks={previewRanks}
        knownPlayers={knownPlayers.players}
        fearlessBannedHeroIds={previewBannedHeroIds}
        seriesState={previewSeriesState}
        selectedId={view === 'components' ? activeMemberId : undefined}
        enabled={overlayConfig.enabled}
        settings={overlayConfig.settings}
        options={overlayConfig.options}
        background={previewBackground.inGame ? 'ingame' : 'checkerboard'}
        customCss={overlayConfig.customCss}
      />
    </div>
  </div>
</section>
