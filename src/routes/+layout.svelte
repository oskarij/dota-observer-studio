<script lang="ts">
  import { onMount } from 'svelte';
  import { ModeWatcher } from 'mode-watcher';

  import AppHeader from '$lib/components/app-header.svelte';
  import AppSidebar from '$lib/components/app-sidebar.svelte';
  import { overlayConfig } from '$lib/state/overlayConfig.svelte.js';

  import '../styles/app.css';

  let { children } = $props();

  // The config is shared app-wide, so its lifecycle lives here rather than on any one page:
  // load once, and keep the close-guard wired no matter which route is active.
  onMount(() => {
    void overlayConfig.load();

    // When the close-guard chooses "Save", persist then let main proceed with the quit.
    return globalThis.window?.dotaSpectatorTools?.app?.onSaveAndQuit(async () => {
      await overlayConfig.save();
      globalThis.window?.dotaSpectatorTools?.app?.confirmQuit();
    });
  });

  // Mirror the dirty flag to the main process so it can guard the window close.
  $effect(() => {
    globalThis.window?.dotaSpectatorTools?.app?.setDirty(overlayConfig.dirty);
  });
</script>

<ModeWatcher />

<div class="flex h-svh">
  <AppSidebar />

  <div class="flex min-w-0 flex-1 flex-col">
    <AppHeader />

    <main class="min-h-0 flex-1 overflow-y-auto">
      {@render children()}
    </main>
  </div>
</div>
