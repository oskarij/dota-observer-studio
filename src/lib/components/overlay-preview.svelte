<script lang="ts">
  import { SAMPLE_GSI_DATA } from '$lib/dev/sampleGsiData.js';
  import { createOverlayStage, type OverlayStage } from '../../overlay/overlayStage.js';
  import type { DotaGsiData } from '../../shared/dotaGsiPayload.js';

  // The overlay elements are authored against a fixed 1080p canvas.
  const STAGE_WIDTH = 1920;
  const STAGE_HEIGHT = 1080;

  let { gsiData = SAMPLE_GSI_DATA }: { gsiData?: DotaGsiData } = $props();

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
    stage?.update(gsiData);
  });

  // Contain the 1080p stage within the available area so it never overflows.
  $effect(() => {
    if (root === null) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
    });
    observer.observe(root);

    return () => observer.disconnect();
  });
</script>

<div bind:this={root} class="flex h-full w-full items-center justify-center">
  <!-- Largest 16:9 frame that fits the available area, centered. -->
  <div
    class="checkerboard relative overflow-hidden border"
    style="width: {STAGE_WIDTH * scale}px; height: {STAGE_HEIGHT * scale}px;"
  >
    <div
      bind:this={stageEl}
      class="absolute top-0 left-0 origin-top-left"
      style="width: {STAGE_WIDTH}px; height: {STAGE_HEIGHT}px; transform: scale({scale});"
    ></div>
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
