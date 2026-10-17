<script lang="ts">
  import { Slider } from '$lib/components/ui/slider/index.js';
  import {
    TEAM_NAME_MAX_WIDTH_RANGE,
    type TeamNameOptions
  } from '../../shared/componentOptions.js';

  let { options = $bindable() }: { options?: TeamNameOptions | undefined } = $props();
</script>

{#if options}
  <section class="col-span-2 flex flex-col gap-2">
    <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Max width
    </span>
    <div class="flex items-center gap-3">
      <Slider
        type="single"
        min={TEAM_NAME_MAX_WIDTH_RANGE.min}
        max={TEAM_NAME_MAX_WIDTH_RANGE.max}
        step={TEAM_NAME_MAX_WIDTH_RANGE.step}
        bind:value={options.maxWidth}
      />
      <span class="w-24 shrink-0 text-right text-sm tabular-nums">{options.maxWidth}px</span>
    </div>
  </section>
{/if}
