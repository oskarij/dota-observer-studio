<script lang="ts">
  import InfoIcon from '@lucide/svelte/icons/info';
  import { onMount } from 'svelte';

  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import { GsiStatusWatcher, type GsiConnectionStatus } from '$lib/gsiStatus.svelte.js';
  import { cn } from '$lib/utils.js';

  const PRESENTATION: Record<GsiConnectionStatus, { dotClass: string; label: string }> = {
    connected: { dotClass: 'bg-green-500', label: 'Connected' },
    disconnected: { dotClass: 'bg-destructive', label: 'Not connected' }
  };

  const watcher = new GsiStatusWatcher();

  onMount(() => watcher.start());

  const presentation = $derived(PRESENTATION[watcher.status]);
</script>

<div class="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
  <span aria-hidden="true" class={cn('size-2 shrink-0 rounded-full', presentation.dotClass)}></span>
  <span class="leading-none">{presentation.label}</span>
  {#if watcher.status === 'disconnected'}
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger
          class="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Why is GSI not connected?"
        >
          <InfoIcon class="size-3.5" />
        </Tooltip.Trigger>
        <Tooltip.Content class="max-w-[160px]">
          Dota only starts sending GSI data once you join or spectate a game.
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  {/if}
</div>
