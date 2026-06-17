<script lang="ts">
  import { page } from '$app/state';

  import SelectedPlayerOptionsForm from '$lib/components/selected-player-options.svelte';
  import * as Select from '$lib/components/ui/select/index.js';
  import { overlayConfig } from '$lib/state/overlayConfig.svelte.js';
  import { SELECTED_PLAYER_ID } from '../../shared/componentOptions.js';
  import { OVERLAY_ELEMENT_DEFINITIONS } from '../../shared/overlayElementCatalog.js';

  // Seeded from the URL's ?id= (set by the overlay page's gear); the dropdown then drives it
  // locally. Falls back to the first component so the page is never empty.
  let selectedId = $state(page.url.searchParams.get('id') ?? OVERLAY_ELEMENT_DEFINITIONS[0]?.id);

  let selected = $derived(OVERLAY_ELEMENT_DEFINITIONS.find((element) => element.id === selectedId));
</script>

<svelte:head>
  <title>Components | Observer Studio</title>
  <meta content="Per-component settings for Dota Observer Studio." name="description" />
</svelte:head>

<section class="flex h-full min-h-0 flex-col gap-4 p-6 max-sm:p-4">
  <!-- The component selector doubles as the page title. -->
  <div class="flex flex-col gap-1">
    <span class="text-sm font-medium text-muted-foreground">Components</span>
    <Select.Root type="single" value={selectedId} onValueChange={(value) => (selectedId = value)}>
      <Select.Trigger class="w-64">
        <span class="min-w-0 flex-1 truncate text-left font-semibold">
          {selected?.name ?? 'Select a component'}
        </span>
      </Select.Trigger>
      <Select.Content>
        {#each OVERLAY_ELEMENT_DEFINITIONS as definition (definition.id)}
          <Select.Item value={definition.id} label={definition.name}>{definition.name}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  </div>

  <!-- One box per setting. -->
  <div class="flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-3 overflow-y-auto">
    {#if selected === undefined}
      <div class="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        Select a component to edit its settings.
      </div>
    {:else if selectedId === SELECTED_PLAYER_ID}
      <SelectedPlayerOptionsForm bind:options={overlayConfig.options[selectedId]} />
    {:else}
      <div class="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        This component has no settings yet.
      </div>
    {/if}
  </div>
</section>
