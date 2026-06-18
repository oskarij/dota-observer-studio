<script lang="ts">
  import { onMount } from 'svelte';

  import { OVERLAY_ELEMENT_DEFINITIONS } from '../shared/overlayElementCatalog.js';
  import ComponentMenu from '$lib/components/component-menu.svelte';
  import ComponentSettingsPanel from '$lib/components/component-settings.svelte';
  import OverlayPreview from '$lib/components/overlay-preview.svelte';
  import { GsiFeed } from '$lib/gsiFeed.svelte.js';
  import { overlayConfig } from '$lib/state/overlayConfig.svelte.js';
  import { previewSource } from '$lib/state/previewSource.svelte.js';

  // The selected component drives the settings panel; defaults to the first.
  let selectedId = $state<string | undefined>(OVERLAY_ELEMENT_DEFINITIONS[0]?.id);

  // Sample (static, always available) vs. live game feed. In live mode the preview shows the
  // real GSI payload, or a "waiting" hint (null) when no fresh feed is arriving. The selection
  // lives in a shared store so it persists across navigation.
  const feed = new GsiFeed();
  onMount(() => feed.start());

  let previewData = $derived(previewSource.live ? feed.data : undefined);
  // Ranks only apply in live mode; the sample snapshot supplies its own inside OverlayPreview.
  let previewRanks = $derived(previewSource.live ? feed.ranks : []);

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

      <!-- Source selector: static sample vs. live game feed. -->
      <div
        class="inline-flex items-center gap-0.5 rounded-lg border bg-muted p-0.5 text-sm"
        role="group"
        aria-label="Preview source"
      >
        <button
          type="button"
          class="rounded-md px-3 py-1 font-medium transition-colors {!previewSource.live
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'}"
          aria-pressed={!previewSource.live}
          onclick={() => (previewSource.live = false)}
        >
          Sample
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1 font-medium transition-colors {previewSource.live
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'}"
          aria-pressed={previewSource.live}
          onclick={() => (previewSource.live = true)}
        >
          Live
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 p-4">
      <OverlayPreview
        gsiData={previewData}
        ranks={previewRanks}
        enabled={overlayConfig.enabled}
        settings={overlayConfig.settings}
        options={overlayConfig.options}
      />
    </div>
  </div>
</section>
