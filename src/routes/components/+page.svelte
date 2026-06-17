<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';

  import { OVERLAY_ELEMENT_DEFINITIONS } from '../../shared/overlayElementCatalog.js';

  // The active component is the URL's ?id= (set by the overlay page's gear), falling back to
  // the first component so the page is never empty. The left list updates the same param.
  let selectedId = $derived(page.url.searchParams.get('id') ?? OVERLAY_ELEMENT_DEFINITIONS[0]?.id);

  let selected = $derived(OVERLAY_ELEMENT_DEFINITIONS.find((element) => element.id === selectedId));
</script>

<svelte:head>
  <title>Components | Observer Studio</title>
  <meta content="Per-component settings for Dota Observer Studio." name="description" />
</svelte:head>

<section class="flex h-full min-h-0 gap-3 p-6 max-sm:gap-2 max-sm:p-4">
  <!-- Selector: which component's settings we're editing. -->
  <div
    class="flex min-h-0 w-64 shrink-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm"
  >
    <div class="flex h-12 shrink-0 items-center border-b px-4">
      <span class="text-base font-semibold">Components</span>
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {#each OVERLAY_ELEMENT_DEFINITIONS as definition (definition.id)}
        {@const isSelected = selectedId === definition.id}
        <a
          aria-current={isSelected ? 'page' : undefined}
          class="flex items-center border-b px-4 py-3.5 text-left text-sm leading-none transition-colors last:border-b-0 {isSelected
            ? 'bg-primary/10'
            : 'hover:bg-muted'}"
          data-sveltekit-replacestate
          href="{resolve('/components')}?id={definition.id}"
        >
          <span class="truncate">{definition.name}</span>
        </a>
      {/each}
    </div>
  </div>

  <!-- Detail: the selected component's non-styling settings (form lands in the next step). -->
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
    <div class="flex h-12 shrink-0 items-center border-b px-4">
      <span class="text-base font-semibold"
        >{selected ? `${selected.name} Settings` : 'Settings'}</span
      >
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      {#if selected === undefined}
        <span class="text-sm text-muted-foreground">Select a component to edit its settings.</span>
      {:else}
        <p class="text-sm text-muted-foreground">
          Settings for {selected.name} will live here.
        </p>
      {/if}
    </div>
  </div>
</section>
