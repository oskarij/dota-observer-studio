<script lang="ts">
  import { getHeroIconUrl } from '../../overlay/elements/fearlessDraft/heroIcons.js';
  import { getHero } from '../../shared/heroes/heroCatalog.js';

  // Renders a row of hero portraits by id, reusing the same bundled icons + catalog as the overlay
  // so the studio and the live grid stay visually consistent. Optional `labels` (aligned with
  // heroIds, e.g. player names) are appended to each icon's hover tooltip. `scroll` keeps the strip
  // on one line and scrolls it instead of wrapping — for icons sitting in a table-like row.
  let {
    heroIds,
    width = 56,
    labels = [],
    scroll = false
  }: { heroIds: number[]; width?: number; labels?: string[]; scroll?: boolean } = $props();

  function iconUrl(heroId: number): string | null {
    const hero = getHero(heroId);
    return hero === undefined ? null : getHeroIconUrl(hero.internalName);
  }

  function heroName(heroId: number): string {
    return getHero(heroId)?.localizedName ?? `#${heroId}`;
  }

  function tooltip(heroId: number, index: number): string {
    const label = labels[index];
    return label !== undefined && label !== ''
      ? `${heroName(heroId)} — ${label}`
      : heroName(heroId);
  }
</script>

<!-- shrink-0 on the icons: without it a cramped flex row squeezes them into each other. -->
<div class="flex gap-1 {scroll ? 'overflow-x-auto pb-1' : 'flex-wrap'}">
  {#each heroIds as heroId, index (`${heroId}-${index}`)}
    {@const url = iconUrl(heroId)}
    <div
      class="shrink-0 overflow-hidden rounded border border-border bg-muted"
      style="width: {width}px; aspect-ratio: 16 / 9;"
      title={tooltip(heroId, index)}
    >
      {#if url !== null}
        <img src={url} alt={heroName(heroId)} class="h-full w-full object-cover" />
      {:else}
        <span class="flex h-full w-full items-center justify-center text-[10px] leading-none">
          {heroName(heroId)}
        </span>
      {/if}
    </div>
  {/each}
</div>
