<script lang="ts">
  import SaveIcon from '@lucide/svelte/icons/save';

  import { OVERLAY_ELEMENT_DEFINITIONS } from '../shared/overlayElementCatalog.js';
  import ComponentMenu from '$lib/components/component-menu.svelte';
  import GsiStatusIndicator from '$lib/components/gsi-status-indicator.svelte';
  import OverlayPreview from '$lib/components/overlay-preview.svelte';
  import { Button } from '$lib/components/ui/button/index.js';

  let componentEnabled = $state<Record<string, boolean>>(
    Object.fromEntries(OVERLAY_ELEMENT_DEFINITIONS.map((element) => [element.id, element.enabled]))
  );
</script>

<svelte:head>
  <title>Overlay | Observer Studio</title>
  <meta content="Live preview of the Dota Observer Studio overlay." name="description" />
</svelte:head>

<div class="flex h-svh flex-col">
  <header class="flex h-16 shrink-0 items-center justify-between px-6 max-sm:px-4">
    <span class="text-lg font-semibold leading-none">Observer Studio</span>

    <div class="flex items-center gap-4">
      <GsiStatusIndicator />

      <Button class="border-primary text-primary" size="lg" variant="outline">
        <SaveIcon />
        Save
      </Button>
    </div>
  </header>

  <section class="flex min-h-0 flex-1 gap-3 px-6 pb-6 max-sm:gap-2 max-sm:px-4 max-sm:pb-4">
    <ComponentMenu enabled={componentEnabled} />

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
      <div class="flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4">
        <span class="text-base font-semibold">Preview</span>

        <!-- Toolbar slot: game-state selector, background-image toggle, zoom, etc. -->
        <div class="flex items-center gap-2"></div>
      </div>

      <div class="min-h-0 flex-1 p-4">
        <OverlayPreview enabled={componentEnabled} />
      </div>
    </div>
  </section>
</div>
