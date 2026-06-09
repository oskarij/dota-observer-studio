<script lang="ts">
  import { onMount } from 'svelte';

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
</div>
