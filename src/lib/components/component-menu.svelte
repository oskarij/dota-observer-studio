<script lang="ts">
  import { resolve } from '$app/paths';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import EyeOffIcon from '@lucide/svelte/icons/eye-off';
  import SettingsIcon from '@lucide/svelte/icons/settings';

  import { FEARLESS_DRAFT_ID, type OverlayMenuEntry } from '../../shared/overlayElementCatalog.js';

  // The page passes the menu entries for the currently selected phase (already filtered) so the
  // menu is a dumb list. Mutating enabled[id] propagates to the parent's $state proxy; no bind:
  // needed. selectedKey is owned by the page so the settings panel can read the selection.
  let {
    entries,
    enabled,
    selectedKey = $bindable()
  }: {
    entries: OverlayMenuEntry[];
    enabled: Record<string, boolean>;
    selectedKey?: string | undefined;
  } = $props();

  // A paired row (radiant + dire) counts as enabled only when every member is; toggling sets all
  // members, so a mixed pair turns fully on with one click.
  function isEntryEnabled(entry: OverlayMenuEntry): boolean {
    return entry.members.every((member) => enabled[member.id] ?? false);
  }

  function toggleVisibility(entry: OverlayMenuEntry) {
    const next = !isEntryEnabled(entry);
    for (const member of entry.members) {
      enabled[member.id] = next;
    }
  }
</script>

<div class="flex min-h-28 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
  <div class="flex h-12 shrink-0 items-center border-b px-4">
    <span class="text-base font-semibold">Components</span>
  </div>

  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
    {#each entries as entry (entry.key)}
      {@const isEnabled = isEntryEnabled(entry)}
      {@const isSelected = selectedKey === entry.key}
      <div
        class="relative flex items-center border-b transition-colors last:border-b-0 {isSelected
          ? 'bg-primary/10'
          : ''}"
      >
        <!-- Stretched-link pattern: this button's ::before covers the whole row so the
             item selects everywhere, while the eye floats above it (z-10). -->
        <button
          type="button"
          class="flex min-w-0 flex-1 cursor-pointer items-center px-4 py-3.5 text-left before:absolute before:inset-0 before:content-['']"
          onclick={() => (selectedKey = entry.key)}
        >
          <span
            class="truncate text-sm leading-none transition-opacity {isEnabled ? '' : 'opacity-50'}"
          >
            {entry.menuLabel}
          </span>
        </button>

        <!-- These float above the row's stretched-link (z-10) so they stay clickable. -->
        <div class="relative z-10 mr-3 flex shrink-0 items-center gap-1">
          <!-- Behavioral options live inline below the settings panel now; only the fearless draft
               still has a dedicated management page (its series lives on the Series page). -->
          {#if entry.key === FEARLESS_DRAFT_ID}
            <a
              aria-label={`Manage ${entry.menuLabel}`}
              class="flex size-7 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              href={resolve('/series')}
            >
              <SettingsIcon class="size-4" />
            </a>
          {/if}

          <button
            type="button"
            aria-label={isEnabled ? `Hide ${entry.menuLabel}` : `Show ${entry.menuLabel}`}
            aria-pressed={isEnabled}
            class="flex size-7 cursor-pointer items-center justify-center transition-colors {isEnabled
              ? 'text-primary hover:text-primary/70'
              : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => toggleVisibility(entry)}
          >
            {#if isEnabled}
              <EyeIcon class="size-4" />
            {:else}
              <EyeOffIcon class="size-4" />
            {/if}
          </button>
        </div>
      </div>
    {/each}
  </div>
</div>
