<script lang="ts">
  import { OVERLAY_ELEMENT_DEFINITIONS } from '../shared/overlayElementCatalog.js';
  import ComponentMenu from '$lib/components/component-menu.svelte';
  import ComponentSettingsPanel from '$lib/components/component-settings.svelte';
  import OverlayPreview from '$lib/components/overlay-preview.svelte';
  import { overlayConfig } from '$lib/state/overlayConfig.svelte.js';

  // The selected component drives the settings panel; defaults to the first.
  let selectedId = $state<string | undefined>(OVERLAY_ELEMENT_DEFINITIONS[0]?.id);

  let selectedName = $derived(
    OVERLAY_ELEMENT_DEFINITIONS.find((element) => element.id === selectedId)?.name
  );

  function resetSelected(): void {
    if (selectedId !== undefined) {
      overlayConfig.resetComponent(selectedId);
    }
  }
</script>

<svelte:head>
  <title>Overlay | Observer Studio</title>
  <meta content="Live preview of the Dota Observer Studio overlay." name="description" />
</svelte:head>

<section class="flex h-full min-h-0 gap-3 px-6 py-4 max-sm:gap-2 max-sm:px-4">
  <div class="flex min-h-0 w-64 shrink-0 flex-col gap-3">
    <ComponentMenu enabled={overlayConfig.enabled} bind:selectedId />
    {#if selectedId === undefined}
      <ComponentSettingsPanel />
    {:else}
      <ComponentSettingsPanel
        name={selectedName}
        bind:settings={overlayConfig.settings[selectedId]}
        onReset={resetSelected}
      />
    {/if}
  </div>

  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
    <div class="flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4">
      <span class="text-base font-semibold">Preview</span>

      <!-- Toolbar slot: game-state selector, background-image toggle, zoom, etc. -->
      <div class="flex items-center gap-2"></div>
    </div>

    <div class="min-h-0 flex-1 p-4">
      <OverlayPreview
        enabled={overlayConfig.enabled}
        settings={overlayConfig.settings}
        options={overlayConfig.options}
      />
    </div>
  </div>
</section>
