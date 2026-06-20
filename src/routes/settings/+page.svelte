<script lang="ts">
  import { onMount } from 'svelte';

  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Switch } from '$lib/components/ui/switch/index.js';
  import { network as networkStore } from '$lib/state/network.svelte.js';
  import { overlayConfig } from '$lib/state/overlayConfig.svelte.js';
  import {
    type ConfigurablePorts,
    type NetworkInfo,
    validatePorts
  } from '../../shared/networkConfig.js';

  const bridge = globalThis.window?.dotaSpectatorTools;

  let network = $state<NetworkInfo | null>(null);
  // Editable port drafts (numbers; NaN when the field is cleared, which validation rejects).
  let ports = $state<ConfigurablePorts>({ overlayHost: NaN, gsiListener: NaN });
  let allowLanAccess = $state(false);

  let portError = $derived(validatePorts(ports));
  let portsDirty = $derived(
    network !== null &&
      (ports.overlayHost !== network.ports.overlayHost ||
        ports.gsiListener !== network.ports.gsiListener)
  );

  let gsiStatus = $state<string | null>(null);
  let copyStatus = $state<string | null>(null);
  let portStatus = $state<string | null>(null);
  let dataStatus = $state<string | null>(null);
  let cacheStatus = $state<string | null>(null);
  let busy = $state(false);

  // Swaps the trigger for an inline confirm/cancel pair (mirrors the component "Reset to defaults" affordance).
  let confirmingClear = $state(false);

  onMount(async () => {
    network = (await bridge?.network?.get()) ?? null;
    if (network !== null) {
      ports = { ...network.ports };
      allowLanAccess = network.allowLanAccess;
    }
  });

  async function installGsi(): Promise<void> {
    if (busy) return;
    busy = true;
    gsiStatus = null;
    try {
      const result = await bridge?.gsi?.install();
      gsiStatus = result?.ok
        ? `Installed to ${result.path}`
        : (result?.reason ?? 'GSI bridge unavailable.');
    } finally {
      busy = false;
    }
  }

  async function exportGsi(): Promise<void> {
    if (busy) return;
    busy = true;
    gsiStatus = null;
    try {
      const result = await bridge?.gsi?.export();
      gsiStatus = result?.ok
        ? `Exported to ${result.path}. Copy it into the gamestate_integration folder on the other PC.`
        : (result?.reason ?? 'GSI bridge unavailable.');
    } finally {
      busy = false;
    }
  }

  async function copyOverlayUrl(): Promise<void> {
    if (network === null) return;
    await globalThis.navigator.clipboard.writeText(network.overlayUrl);
    copyStatus = 'Copied to clipboard.';
  }

  async function savePorts(): Promise<void> {
    if (busy || portError !== null || !portsDirty) return;
    busy = true;
    portStatus = null;
    try {
      const result = await bridge?.network?.set({ ports: $state.snapshot(ports), allowLanAccess });
      if (result?.ok) {
        network = (await bridge?.network?.get()) ?? network;
        void networkStore.refresh();
        portStatus = 'Saved. Update your OBS source URL if you changed a port.';
      } else {
        portStatus = result?.reason ?? 'Could not save.';
      }
    } finally {
      busy = false;
    }
  }

  // The LAN switch persists on toggle (it applies on the next restart), so it isn't tied to the
  // port Save below. Saved ports are reused so an unsaved port draft isn't committed by the toggle.
  async function applyLanAccess(value: boolean): Promise<void> {
    allowLanAccess = value;
    if (busy || network === null) return;
    busy = true;
    try {
      const result = await bridge?.network?.set({
        ports: { ...network.ports },
        allowLanAccess: value
      });
      if (result?.ok) {
        network = (await bridge?.network?.get()) ?? network;
        void networkStore.refresh();
      }
    } finally {
      busy = false;
    }
  }

  async function exportConfig(): Promise<void> {
    if (busy) return;
    busy = true;
    dataStatus = null;
    try {
      const result = await bridge?.settings?.export();
      dataStatus = result?.ok ? `Exported to ${result.path}` : (result?.reason ?? null);
    } finally {
      busy = false;
    }
  }

  async function importConfig(): Promise<void> {
    if (busy) return;
    busy = true;
    dataStatus = null;
    try {
      const result = await bridge?.settings?.import();
      if (result?.ok) {
        // Refresh the renderer's working copy + reset dirty state from the imported config.
        await overlayConfig.load();
        dataStatus = 'Imported. The overlay layout has been updated.';
      } else {
        dataStatus = result?.reason ?? null;
      }
    } finally {
      busy = false;
    }
  }

  async function clearRankCache(): Promise<void> {
    if (busy) return;
    busy = true;
    confirmingClear = false;
    try {
      await bridge?.playerRanks?.clear();
      cacheStatus = 'Rank cache cleared. Ranks refetch on the next spectated game.';
    } catch {
      cacheStatus = 'Could not clear the rank cache.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Settings | Observer Studio</title>
  <meta content="Observer Studio settings." name="description" />
</svelte:head>

{#snippet status(message: string | null)}
  {#if message !== null}
    <p class="text-xs text-muted-foreground">{message}</p>
  {/if}
{/snippet}

<section class="grid max-w-3xl gap-6 p-6 max-sm:p-4">
  <div class="grid gap-1 border-b pb-6">
    <p class="text-sm font-medium text-muted-foreground">Settings</p>
    <h1 class="text-2xl font-semibold leading-tight">Settings</h1>
  </div>

  <div class="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
    <div class="grid gap-1">
      <h2 class="text-sm font-semibold">Game integration</h2>
      <p class="text-xs text-muted-foreground">
        Write Dota 2's Game State Integration config so the game sends match data to Observer
        Studio.
      </p>
    </div>
    {#if network !== null}
      <p class="font-mono text-xs text-muted-foreground">{network.gsiUrl}</p>
    {/if}
    <div class="flex flex-wrap gap-2">
      <Button onclick={installGsi} disabled={busy}>Install GSI config</Button>
      {#if network?.allowLanAccess && !network.restartRequired}
        <Button variant="outline" onclick={exportGsi} disabled={busy}>
          Export config for another PC
        </Button>
      {/if}
    </div>
    {@render status(gsiStatus)}
    <div class="grid gap-1 border-t pt-3">
      <p class="text-xs font-medium">
        Required launch option: <span class="font-mono">-gamestateintegration</span>
      </p>
      <ol class="grid list-decimal gap-0.5 pl-4 text-xs text-muted-foreground">
        <li>Steam → right-click Dota 2 → Properties → General → Launch Options</li>
        <li>Add <span class="font-mono">-gamestateintegration</span></li>
        <li>Restart Dota 2</li>
      </ol>
    </div>
  </div>

  <div class="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
    <div class="grid gap-1">
      <h2 class="text-sm font-semibold">OBS browser source</h2>
      <p class="text-xs text-muted-foreground">
        Add a Browser source in OBS pointing at this URL to show the overlay.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <Input class="font-mono" value={network?.overlayUrl ?? ''} readonly />
      <Button variant="outline" onclick={copyOverlayUrl} disabled={network === null}>Copy</Button>
    </div>
    {@render status(copyStatus)}
  </div>

  <div class="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
    <div class="grid gap-1">
      <h2 class="text-sm font-semibold">Network access</h2>
      <p class="text-xs text-muted-foreground">
        By default the overlay is reachable only on this PC. Enable LAN access to use OBS or Dota on
        another PC on your network.
      </p>
    </div>

    <div class="flex items-center justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-0.5">
        <span class="text-sm font-medium">Allow LAN access</span>
        <span class="text-xs text-muted-foreground">
          Exposes the overlay, event stream, and GSI listener to your local network.
        </span>
      </div>
      <Switch checked={allowLanAccess} onCheckedChange={applyLanAccess} disabled={busy} />
    </div>

    {#if network?.allowLanAccess && !network.restartRequired}
      <p class="text-xs text-muted-foreground">
        For Dota on another PC, point its GSI config at <span class="font-mono"
          >{network.gsiUrl}</span
        >.
      </p>
    {/if}

    <div class="flex flex-wrap items-end gap-3 border-t pt-3">
      <div class="flex w-40 flex-col gap-1">
        <span class="text-xs text-muted-foreground">Overlay host port</span>
        <Input type="number" bind:value={ports.overlayHost} />
      </div>
      <div class="flex w-40 flex-col gap-1">
        <span class="text-xs text-muted-foreground">GSI listener port</span>
        <Input type="number" bind:value={ports.gsiListener} />
      </div>
      <Button onclick={savePorts} disabled={busy || portError !== null || !portsDirty}>Save</Button>
    </div>
    {#if portError !== null}
      <p class="text-xs text-destructive">{portError.message}</p>
    {:else}
      {@render status(portStatus)}
    {/if}
    {#if network?.restartRequired}
      <p class="text-xs text-amber-600 dark:text-amber-500">
        Restart Observer Studio to apply the LAN access change.
      </p>
    {/if}
  </div>

  <div class="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
    <div class="grid gap-1">
      <h2 class="text-sm font-semibold">Overlay config backup</h2>
      <p class="text-xs text-muted-foreground">
        Export the full overlay layout to a JSON file, or import one to replace the current layout.
      </p>
    </div>
    <div class="flex gap-2">
      <Button variant="outline" onclick={exportConfig} disabled={busy}>Export config</Button>
      <Button variant="outline" onclick={importConfig} disabled={busy}>Import config</Button>
    </div>
    {@render status(dataStatus)}
  </div>

  <div class="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
    <div class="grid gap-1">
      <h2 class="text-sm font-semibold">Maintenance</h2>
      <p class="text-xs text-muted-foreground">
        Clear the cached OpenDota ranks used for the in-game medal.
      </p>
    </div>
    <div class="flex items-center gap-2">
      {#if confirmingClear}
        <span class="text-xs text-muted-foreground">Clear the rank cache?</span>
        <Button variant="destructive" onclick={clearRankCache} disabled={busy}>Clear</Button>
        <Button variant="ghost" onclick={() => (confirmingClear = false)} disabled={busy}>
          Cancel
        </Button>
      {:else}
        <Button variant="outline" onclick={() => (confirmingClear = true)} disabled={busy}>
          Clear rank cache
        </Button>
      {/if}
    </div>
    {@render status(cacheStatus)}
  </div>
</section>
