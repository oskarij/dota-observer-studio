<script lang="ts">
  import SaveIcon from '@lucide/svelte/icons/save';
  import { onMount } from 'svelte';

  import { OVERLAY_ELEMENT_DEFINITIONS } from '../shared/overlayElementCatalog.js';
  import ComponentMenu from '$lib/components/component-menu.svelte';
  import ComponentSettingsPanel from '$lib/components/component-settings.svelte';
  import GsiStatusIndicator from '$lib/components/gsi-status-indicator.svelte';
  import OverlayPreview from '$lib/components/overlay-preview.svelte';
  import { OverlayConfigStore } from '$lib/state/overlayConfig.svelte.js';
  import { Button } from '$lib/components/ui/button/index.js';

  const config = new OverlayConfigStore();

  onMount(() => {
    void config.load();
  });

  // The selected component drives the settings panel; defaults to the first.
  let selectedId = $state<string | undefined>(OVERLAY_ELEMENT_DEFINITIONS[0]?.id);

  let selectedName = $derived(
    OVERLAY_ELEMENT_DEFINITIONS.find((element) => element.id === selectedId)?.name
  );

  function resetSelected(): void {
    if (selectedId !== undefined) {
      config.resetComponent(selectedId);
    }
  }
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

      {#if config.dirty}
        <span class="text-sm text-muted-foreground" role="status" aria-live="polite">
          Unsaved changes
        </span>
      {/if}

      <Button size="lg" variant="ghost" disabled={!config.dirty} onclick={() => config.discard()}>
        Discard
      </Button>

      <Button
        class="border-primary text-primary"
        size="lg"
        variant="outline"
        disabled={!config.dirty}
        onclick={() => config.save()}
      >
        <SaveIcon />
        Save
      </Button>
    </div>
  </header>

  <section class="flex min-h-0 flex-1 gap-3 px-6 pb-6 max-sm:gap-2 max-sm:px-4 max-sm:pb-4">
    <div class="flex w-64 min-h-0 shrink-0 flex-col gap-3">
      <ComponentMenu enabled={config.enabled} bind:selectedId />
      {#if selectedId === undefined}
        <ComponentSettingsPanel />
      {:else}
        <ComponentSettingsPanel
          name={selectedName}
          bind:settings={config.settings[selectedId]}
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
        <OverlayPreview enabled={config.enabled} settings={config.settings} />
      </div>
    </div>
  </section>
</div>
