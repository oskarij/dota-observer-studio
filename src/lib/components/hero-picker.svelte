<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { getHeroIconUrl } from '../../overlay/elements/fearlessDraft/heroIcons.js';
  import { getAllHeroes } from '../../shared/heroes/heroCatalog.js';

  // Inline graphical hero picker: a searchable grid of every hero, click to toggle. Used to enter a
  // game's heroes by hand when OpenDota can't parse the match. onConfirm receives the selected ids.
  // disabledHeroIds (heroes already banned in the series) are greyed out and can't be selected.
  let {
    onConfirm,
    onCancel,
    disabledHeroIds = []
  }: {
    onConfirm: (heroIds: number[]) => void;
    onCancel: () => void;
    disabledHeroIds?: number[];
  } = $props();

  const heroes = getAllHeroes();

  let search = $state('');
  let selected = $state<number[]>([]);

  let disabledSet = $derived(new Set(disabledHeroIds));

  let filtered = $derived.by(() => {
    const query = search.trim().toLowerCase();
    if (query === '') {
      return heroes;
    }
    return heroes.filter((hero) => hero.localizedName.toLowerCase().includes(query));
  });

  function isSelected(heroId: number): boolean {
    return selected.includes(heroId);
  }

  function toggle(heroId: number): void {
    if (disabledSet.has(heroId)) {
      return;
    }
    selected = isSelected(heroId) ? selected.filter((id) => id !== heroId) : [...selected, heroId];
  }

  function iconClass(heroId: number): string {
    if (disabledSet.has(heroId)) {
      return 'opacity-25 grayscale';
    }
    return isSelected(heroId) ? '' : 'opacity-80';
  }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
  <div class="flex items-center justify-between gap-2">
    <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Pick heroes manually
    </span>
    <span class="text-xs text-muted-foreground">{selected.length} selected</span>
  </div>

  <Input bind:value={search} placeholder="Search heroes" />

  <div
    class="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(72px,1fr))] content-start gap-x-1.5 gap-y-3 overflow-y-auto rounded-md border p-2"
  >
    {#each filtered as hero (hero.id)}
      {@const url = getHeroIconUrl(hero.internalName)}
      {@const banned = disabledSet.has(hero.id)}
      <button
        type="button"
        disabled={banned}
        title={banned ? `${hero.localizedName} (already banned)` : hero.localizedName}
        aria-pressed={isSelected(hero.id)}
        class="overflow-hidden rounded border-2 transition-colors disabled:cursor-not-allowed {isSelected(
          hero.id
        )
          ? 'border-primary'
          : 'border-transparent enabled:hover:border-border'}"
        style="aspect-ratio: 16 / 9;"
        onclick={() => toggle(hero.id)}
      >
        {#if url !== null}
          <img
            src={url}
            alt={hero.localizedName}
            class="h-full w-full object-cover {iconClass(hero.id)}"
          />
        {:else}
          <span
            class="flex h-full w-full items-center justify-center text-[10px] leading-none {banned
              ? 'opacity-40'
              : ''}"
          >
            {hero.localizedName}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  <div class="flex items-center justify-end gap-2">
    <Button size="sm" variant="ghost" onclick={onCancel}>Cancel</Button>
    <Button size="sm" disabled={selected.length === 0} onclick={() => onConfirm([...selected])}>
      Add {selected.length} to series
    </Button>
  </div>
</div>
