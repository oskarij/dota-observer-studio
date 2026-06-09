<script lang="ts">
  import EyeIcon from '@lucide/svelte/icons/eye';
  import EyeOffIcon from '@lucide/svelte/icons/eye-off';

  import { OVERLAY_ELEMENT_DEFINITIONS } from '../../shared/overlayElementCatalog.js';

  // Mutating enabled[id] propagates to the parent's $state proxy; no bind: needed.
  let { enabled }: { enabled: Record<string, boolean> } = $props();

  // The selected component is the one being configured; defaults to the first.
  let selectedId = $state<string | undefined>(OVERLAY_ELEMENT_DEFINITIONS[0]?.id);

  function toggleVisibility(id: string) {
    enabled[id] = !(enabled[id] ?? false);
  }
</script>

<div class="flex w-64 shrink-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
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
          onclick={() => (selectedId = definition.id)}
        >
          <span
            class="truncate text-sm leading-none transition-opacity {isEnabled ? '' : 'opacity-50'}"
          >
            {definition.name}
          </span>
        </button>

        <button
          type="button"
          aria-label={isEnabled ? `Hide ${definition.name}` : `Show ${definition.name}`}
          aria-pressed={isEnabled}
          class="relative z-10 mr-3 flex size-7 shrink-0 cursor-pointer items-center justify-center transition-colors {isEnabled
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
    {/each}
  </div>
</div>
