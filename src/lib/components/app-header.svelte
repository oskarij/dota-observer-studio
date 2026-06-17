<script lang="ts">
  import SaveIcon from '@lucide/svelte/icons/save';

  import GsiStatusIndicator from '$lib/components/gsi-status-indicator.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { overlayConfig } from '$lib/state/overlayConfig.svelte.js';
</script>

<header class="flex h-16 shrink-0 items-center justify-between border-b px-6 max-sm:px-4">
  <div class="flex items-center gap-4">
    <span class="text-lg font-semibold leading-none">Observer Studio</span>
    <GsiStatusIndicator />
  </div>

  <div class="flex items-center gap-4">
    {#if overlayConfig.dirty}
      <span class="text-sm text-muted-foreground" role="status" aria-live="polite">
        Unsaved changes
      </span>
    {/if}

    <Button
      size="lg"
      variant="ghost"
      disabled={!overlayConfig.dirty}
      onclick={() => overlayConfig.discard()}
    >
      Discard
    </Button>

    <Button
      class="border-primary text-primary"
      size="lg"
      variant="outline"
      disabled={!overlayConfig.dirty}
      onclick={() => overlayConfig.save()}
    >
      <SaveIcon />
      Save
    </Button>
  </div>
</header>
