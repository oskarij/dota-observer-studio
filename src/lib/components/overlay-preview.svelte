<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { asset } from '$app/paths';
  import {
    SAMPLE_DRAFT_GSI_DATA,
    SAMPLE_GSI_DATA,
    SAMPLE_KNOWN_PLAYERS
  } from '$lib/dev/sampleGsiData.js';
  import {
    applyOverlayConfigToStage,
    createOverlayStage,
    type OverlayStage
  } from '../../overlay/overlayStage.js';
  import type { ComponentOptionsById } from '../../shared/componentOptions.js';
  import { isMaxWidthOptions } from '../../shared/componentOptions.js';
  import {
    anchoredRegionLeft,
    STAGE_HEIGHT,
    STAGE_WIDTH,
    type ComponentSettings,
    type ElementBox
  } from '../../shared/componentSettings.js';
  import { getSelectedDotaGsiPlayer, type DotaGsiData } from '../../shared/dotaGsiPayload.js';
  import type { KnownPlayer } from '../../shared/knownPlayer.js';
  import type { OverlayPhase } from '../../shared/overlayElementCatalog.js';
  import type { PlayerRank } from '../../shared/overlayPlayerRankEvent.js';
  import { createEmptySeriesPayload, type SeriesStatePayload } from '../../shared/seriesState.js';

  const SAMPLE_RANK_TIER = 74;

  let {
    gsiData = SAMPLE_GSI_DATA,
    ranks = [],
    knownPlayers = [],
    fearlessBannedHeroIds = [],
    seriesState = null,
    phase = null,
    enabled,
    settings,
    options,
    background = 'checkerboard',
    selectedId,
    customCss = ''
  }: {
    gsiData?: DotaGsiData | null | undefined;
    ranks?: PlayerRank[];
    knownPlayers?: readonly KnownPlayer[];

    fearlessBannedHeroIds?: readonly number[];

    seriesState?: SeriesStatePayload | null;

    phase?: OverlayPhase | null;
    enabled?: Record<string, boolean>;
    settings?: Record<string, ComponentSettings>;
    options?: ComponentOptionsById;

    background?: 'checkerboard' | 'ingame';

    selectedId?: string | undefined;

    customCss?: string;
  } = $props();

  export function measureElement(id: string): ElementBox | null {
    return stage?.measure(id) ?? null;
  }

  let selectedBox = $state<ElementBox | null>(null);
  let root = $state<HTMLElement | null>(null);
  let stageEl = $state<HTMLElement | null>(null);
  let stage = $state.raw<OverlayStage | null>(null);
  let scale = $state(0);
  let pageVisible = $state(true);
  let measureFrame: number | null = null;
  const emptySeries = createEmptySeriesPayload();
  const sampleData = $derived(gsiData === SAMPLE_GSI_DATA || gsiData === SAMPLE_DRAFT_GSI_DATA);

  onMount(() => {
    const visibilityChanged = () => {
      pageVisible = !globalThis.document.hidden;
    };
    visibilityChanged();
    globalThis.document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      globalThis.document.removeEventListener('visibilitychange', visibilityChanged);
      if (measureFrame !== null) globalThis.cancelAnimationFrame(measureFrame);
    };
  });

  // The preview shares the studio's document, so the custom CSS is fenced into the stage with
  // @scope. @font-face and @keyframes cannot nest there and stay global, which is harmless.
  let customSheet = $state.raw<CSSStyleSheet | null>(null);
  onMount(() => {
    const { document } = globalThis;
    const sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    customSheet = sheet;
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((other) => other !== sheet);
    };
  });
  /* eslint-disable no-sync -- in-memory CSSOM, not I/O; the async form would race between keystrokes. */
  $effect(() => {
    if (customSheet === null) return;
    const parsed = new CSSStyleSheet();
    parsed.replaceSync(customCss);
    customSheet.replaceSync(
      Array.from(parsed.cssRules, (rule) =>
        rule instanceof CSSStyleRule || rule instanceof CSSGroupingRule
          ? `@scope (.overlay-preview-stage) { ${rule.cssText} }`
          : rule.cssText
      ).join('\n')
    );
  });
  /* eslint-enable no-sync */

  $effect(() => {
    if (stageEl === null || !pageVisible) {
      return;
    }

    const mounted = createOverlayStage(stageEl, phase, {
      motion: 'static',
      clock: sampleData ? 'snapshot' : 'live'
    });
    stage = mounted;

    return () => {
      mounted.destroy();
      stage = null;
      selectedBox = null;
    };
  });

  $effect(() => {
    if (stage === null) {
      return;
    }

    applyOverlayConfigToStage(stage, { enabled, settings, options });
    renderCurrent();
  });

  $effect(() => {
    if (stage === null) return;
    stage.applyKnownPlayers(sampleData ? [...SAMPLE_KNOWN_PLAYERS, ...knownPlayers] : knownPlayers);
    renderCurrent();
  });

  $effect(() => {
    if (stage === null) return;
    stage.applyFearlessSeries({ bannedHeroIds: [...fearlessBannedHeroIds] });
    renderCurrent();
  });

  $effect(() => {
    if (stage === null) return;
    stage.applySeriesState(seriesState ?? emptySeries);
    renderCurrent();
  });

  $effect(() => {
    if (stage === null) return;
    if (sampleData) {
      const accountId = getSelectedDotaGsiPlayer(SAMPLE_GSI_DATA)?.player?.accountid;
      if (accountId !== undefined) {
        stage.applyPlayerRank({ accountId, rankTier: SAMPLE_RANK_TIER });
      }
    } else {
      for (const rank of ranks) stage.applyPlayerRank(rank);
    }
    renderCurrent();
  });

  $effect(() => {
    if (stage === null) return;
    if (gsiData === null) stage.clear();
    else stage.update(gsiData);
    scheduleMeasure();
  });

  function renderCurrent(): void {
    untrack(() => {
      if (stage === null) return;
      if (gsiData === null) stage.clear();
      else stage.update(gsiData);
      scheduleMeasure();
    });
  }

  $effect(() => {
    void selectedId;
    if (selectedId !== undefined) {
      void settings?.[selectedId];
      void options?.[selectedId];
    }
    scheduleMeasure();
  });

  function scheduleMeasure(): void {
    if (measureFrame !== null) return;
    measureFrame = globalThis.requestAnimationFrame(() => {
      measureFrame = null;
      measureOutlines();
    });
  }

  function measureOutlines(): void {
    const box = stage === null || selectedId === undefined ? null : stage.measure(selectedId);
    const setting = selectedId === undefined ? undefined : settings?.[selectedId];
    const option = selectedId === undefined ? undefined : options?.[selectedId];

    if (
      box === null ||
      setting === undefined ||
      option === undefined ||
      !isMaxWidthOptions(option)
    ) {
      selectedBox = box;
      return;
    }

    const width = option.maxWidth * (setting.size / 100);
    selectedBox = {
      x: anchoredRegionLeft(setting.anchor.x, setting.position.x, width),
      y: box.y,
      width,
      height: box.height
    };
  }

  $effect(() => {
    if (root === null) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) {
        return;
      }

      const { width, height } = entry.contentRect;
      scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
    });
    observer.observe(root);

    return () => observer.disconnect();
  });
</script>

<div bind:this={root} class="flex h-full w-full items-center justify-center">
  <div
    class="relative overflow-hidden border {background === 'checkerboard' ? 'checkerboard' : ''}"
    style="width: {STAGE_WIDTH * scale}px; height: {STAGE_HEIGHT * scale}px;{background === 'ingame'
      ? ` background-image: url('${asset('/preview-bg-ingame.png')}'); background-size: cover; background-position: center;`
      : ''}"
  >
    <div
      bind:this={stageEl}
      class="overlay-preview-stage absolute top-0 left-0 origin-top-left"
      style="width: {STAGE_WIDTH}px; height: {STAGE_HEIGHT}px; transform: scale({scale});"
    ></div>

    {#if selectedBox !== null}
      <div
        class="pointer-events-none absolute border-2 border-red-500"
        style="left: {selectedBox.x * scale}px; top: {selectedBox.y *
          scale}px; width: {selectedBox.width * scale}px; height: {selectedBox.height * scale}px;"
      ></div>
    {/if}

    {#if gsiData === null}
      <div class="absolute inset-0 flex items-center justify-center">
        <span
          class="rounded-md bg-background/80 px-3 py-1.5 text-sm text-muted-foreground shadow-sm"
        >
          Waiting for live game data…
        </span>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Transparency checkerboard; the overlay is transparent, so only stage elements are opaque. */
  .checkerboard {
    background-color: #ffffff;
    background-image:
      linear-gradient(45deg, #c8c8c8 25%, transparent 25%),
      linear-gradient(-45deg, #c8c8c8 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #c8c8c8 75%),
      linear-gradient(-45deg, transparent 75%, #c8c8c8 75%);
    background-size: 24px 24px;
    background-position:
      0 0,
      0 12px,
      12px -12px,
      -12px 0;
  }
</style>
