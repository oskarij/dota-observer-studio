<script lang="ts">
  import { Switch } from '$lib/components/ui/switch/index.js';
  import type { DraftBoardOptions } from '../../shared/componentOptions.js';

  let { options = $bindable() }: { options?: DraftBoardOptions | undefined } = $props();
</script>

{#if options}
  <section class="col-span-2 flex flex-col gap-2">
    <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Behavior
    </span>

    <div class="flex items-center justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-0.5">
        <span class="text-sm font-medium">After the draft</span>
        <span class="text-xs text-muted-foreground">
          Keep the board visible through strategy time and the team showcase.
        </span>
      </div>
      <Switch
        class="shrink-0"
        checked={options.showDuringStrategyTime}
        onCheckedChange={(checked) => {
          if (options) {
            options.showDuringStrategyTime = checked;
          }
        }}
      />
    </div>
  </section>
{/if}
