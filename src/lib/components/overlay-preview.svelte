<script lang="ts">
  import { asset } from '$app/paths';
  import { SAMPLE_GSI_DATA } from '$lib/dev/sampleGsiData.js';
  import { createOverlayStage, type OverlayStage } from '../../overlay/overlayStage.js';
  import type { ComponentOptions } from '../../shared/componentOptions.js';
  import type { ComponentSettings } from '../../shared/componentSettings.js';
  import { getSelectedDotaGsiPlayer, type DotaGsiData } from '../../shared/dotaGsiPayload.js';
  import type { KnownPlayer } from '../../shared/knownPlayer.js';
  import type { PlayerRank } from '../../shared/overlayPlayerRankEvent.js';

  // The overlay elements are authored against a fixed 1080p canvas.
  const STAGE_WIDTH = 1920;
  const STAGE_HEIGHT = 1080;

  // In-game name mode derives its medal from OpenDota ranks. Live mode receives them over SSE (via
  // the `ranks` prop); the static sample has no feed, so we synthesize one for its selected player.
  const SAMPLE_RANK_TIER = 74; // Divine

  let {
    gsiData = SAMPLE_GSI_DATA,
    ranks = [],
    knownPlayers = [],
    enabled,
    settings,
    options,
    background = 'checkerboard'
  }: {
    // null = live mode with no fresh feed (render an empty stage + waiting hint); undefined falls
    // back to the static sample.
    gsiData?: DotaGsiData | null | undefined;
    ranks?: PlayerRank[];
    knownPlayers?: KnownPlayer[];
    enabled?: Record<string, boolean>;
    settings?: Record<string, ComponentSettings>;
    options?: Record<string, ComponentOptions>;
    // Backdrop behind the (transparent) overlay: transparency checkerboard or an in-game frame.
    background?: 'checkerboard' | 'ingame';
  } = $props();

  let root = $state<HTMLElement | null>(null);
  let stageEl = $state<HTMLElement | null>(null);
  let stage = $state<OverlayStage | null>(null);
  let scale = $state(0);

  // Mount the real overlay elements into our stage once its node exists.
  $effect(() => {
    if (stageEl === null) {
      return;
    }

    const mounted = createOverlayStage(stageEl);
    stage = mounted;

    return () => {
      mounted.destroy();
      stage = null;
    };
  });

  $effect(() => {
    if (stage === null) {
      return;
    }

    // Apply the menu's toggles before updating so each element re-evaluates its
    // visibility against the latest enabled state, not just on GSI changes.
    for (const [id, value] of Object.entries(enabled ?? {})) {
      stage.setEnabled(id, value);
    }

    for (const [id, value] of Object.entries(settings ?? {})) {
      stage.applySettings(id, value);
    }

    for (const [id, value] of Object.entries(options ?? {})) {
      stage.applyOptions(id, value);
    }

    // Curated names/MMR for "Known name" mode; applied before update so this render resolves them.
    stage.applyKnownPlayers(knownPlayers);

    // null = live mode without a fresh feed: clear rather than render stale/sample content.
    if (gsiData === null) {
      stage.clear();
    } else {
      // Feed ranks before update so the medal resolves on this render. Live ranks arrive via the
      // prop; the sample snapshot synthesizes one for its selected player.
      if (gsiData === SAMPLE_GSI_DATA) {
        const accountId = getSelectedDotaGsiPlayer(gsiData)?.player?.accountid;
        if (accountId !== undefined) {
          stage.applyPlayerRank({ accountId, rankTier: SAMPLE_RANK_TIER });
        }
      } else {
        for (const rank of ranks) {
          stage.applyPlayerRank(rank);
        }
      }

      stage.update(gsiData);
    }
  });

  // Contain the 1080p stage within the available area so it never overflows.
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
  <!-- Largest 16:9 frame that fits the available area, centered. -->
  <div
    class="relative overflow-hidden border {background === 'checkerboard' ? 'checkerboard' : ''}"
    style="width: {STAGE_WIDTH * scale}px; height: {STAGE_HEIGHT * scale}px;{background === 'ingame'
      ? ` background-image: url('${asset('/preview-bg-ingame.png')}'); background-size: cover; background-position: center;`
      : ''}"
  >
    <div
      bind:this={stageEl}
      class="absolute top-0 left-0 origin-top-left"
      style="width: {STAGE_WIDTH}px; height: {STAGE_HEIGHT}px; transform: scale({scale});"
    ></div>

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
  /* Photoshop-style transparency checkerboard — the overlay itself is transparent,
     so only the elements drawn on the stage are opaque. */
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
