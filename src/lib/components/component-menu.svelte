<script lang="ts">
  import { resolve } from '$app/paths';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import EyeOffIcon from '@lucide/svelte/icons/eye-off';
  import SettingsIcon from '@lucide/svelte/icons/settings';

  import { OVERLAY_ELEMENT_DEFINITIONS } from '../../shared/overlayElementCatalog.js';

  // Mutating enabled[id] propagates to the parent's $state proxy; no bind: needed.
  // selectedId is owned by the page so the settings panel can read the selection.
  // onSelect fires only on an explicit click (so the page can react, e.g. switch the preview to the
  // game state the component lives in) without disturbing the persisted choice on mount.
  let {
    enabled,
    selectedId = $bindable(),
    onSelect
  }: {
    enabled: Record<string, boolean>;
    selectedId?: string | undefined;
    onSelect?: (id: string) => void;
  } = $props();

  function toggleVisibility(id: string) {
    enabled[id] = !(enabled[id] ?? false);
  }
</script>

<div class="flex min-h-28 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
  <div class="flex h-12 shrink-0 items-center border-b px-4">
    <span class="text-base font-semibold">Components</span>
  </div>

  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
    {#each OVERLAY_ELEMENT_DEFINITIONS as definition (definition.id)}
      {@const isEnabled = enabled[definition.id] ?? false}
      {@const isSelected = selectedId === definition.id}
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
          onclick={() => {
            selectedId = definition.id;
            onSelect?.(definition.id);
          }}
        >
          <span
            class="truncate text-sm leading-none transition-opacity {isEnabled ? '' : 'opacity-50'}"
          >
            {definition.name}
          </span>
        </button>

        <!-- These float above the row's stretched-link (z-10) so they stay clickable. -->
        <div class="relative z-10 mr-3 flex shrink-0 items-center gap-1">
          <a
            aria-label={`Settings for ${definition.name}`}
            class="flex size-7 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            href="{resolve('/components')}?id={definition.id}"
          >
            <SettingsIcon class="size-4" />
          </a>

          <button
            type="button"
            aria-label={isEnabled ? `Hide ${definition.name}` : `Show ${definition.name}`}
            aria-pressed={isEnabled}
            class="flex size-7 cursor-pointer items-center justify-center transition-colors {isEnabled
              ? 'text-primary hover:text-primary/70'
              : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => toggleVisibility(definition.id)}
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
