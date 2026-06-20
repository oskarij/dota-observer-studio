<script lang="ts">
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { ModeWatcher } from 'mode-watcher';

  import AppHeader from '$lib/components/app-header.svelte';
  import AppSidebar from '$lib/components/app-sidebar.svelte';
  import { knownPlayers } from '$lib/state/knownPlayers.svelte.js';
  import { network } from '$lib/state/network.svelte.js';
  import { overlayConfig } from '$lib/state/overlayConfig.svelte.js';
  import type { NetworkInfo } from '../shared/networkConfig.js';

  import '../styles/app.css';

  let { children } = $props();

  function portConflictText(info: NetworkInfo): string {
    const parts: string[] = [];
    if (info.portConflicts.overlayHost) {
      parts.push(`overlay host port (${info.ports.overlayHost})`);
    }
    if (info.portConflicts.gsiListener) {
      parts.push(`GSI listener port (${info.ports.gsiListener})`);
    }
    return `Another app is using the ${parts.join(' and ')}.`;
  }

  // The config is shared app-wide, so its lifecycle lives here rather than on any one page:
  // load once, and keep the close-guard wired no matter which route is active.
  onMount(() => {
    void overlayConfig.load();
    // Curated player list: edits persist immediately, so it's outside the Save/Discard flow.
    void knownPlayers.load();
    void network.refresh();

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

    {#if network.hasPortConflict && network.info !== null}
      <div
        role="alert"
        class="flex items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-destructive max-sm:px-4"
      >
        <span>{portConflictText(network.info)}</span>
        <a
          href={resolve('/settings')}
          class="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
        >
          Change it in Settings
        </a>
      </div>
    {/if}

    <main class="min-h-0 flex-1 overflow-y-auto">
      {@render children()}
    </main>
  </div>
</div>
