<script lang="ts">
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import SaveIcon from '@lucide/svelte/icons/save';

  import GsiStatusIndicator from '$lib/components/gsi-status-indicator.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { OVERLAY_ROUTE as overlayRoute } from '../shared/overlayElementCatalog.js';

  const overlayUrl = `http://127.0.0.1:3333${overlayRoute}`;
</script>

<svelte:head>
  <title>Overlay | Observer Studio</title>
  <meta
    content="Hosted overlay URL for Dota Observer Studio."
    name="description"
  />
</svelte:head>

<header
  class="flex h-16 items-center justify-between px-6 max-sm:px-4"
>
  <span class="text-lg font-semibold leading-none">Observer Studio</span>

  <div class="flex items-center gap-4">
    <GsiStatusIndicator />

    <Button class="border-primary text-primary" size="lg" variant="outline">
      <SaveIcon />
      Save
    </Button>
  </div>
</header>

<section class="grid gap-6 p-6 max-sm:p-4">
  <div
    class="flex items-end justify-between gap-4 border-b pb-6 max-sm:flex-col max-sm:items-start"
  >
    <div class="grid gap-1">
      <p class="text-sm font-medium text-muted-foreground">Overlay</p>
      <h1 class="text-2xl font-semibold leading-tight">Hosted overlay URL</h1>
    </div>

    <Button href={overlayUrl} rel="noreferrer" target="_blank" variant="outline">
      <ExternalLinkIcon />
      Open overlay
    </Button>
  </div>

  <a
    class="w-full max-w-3xl rounded-md border bg-card px-3 py-2 font-mono text-sm text-card-foreground [overflow-wrap:anywhere]"
    href={overlayUrl}
  >
    {overlayUrl}
  </a>
</section>
