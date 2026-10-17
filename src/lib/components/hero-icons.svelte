<script lang="ts">
  import { getHeroIconUrl } from '../../overlay/elements/fearlessDraft/heroIcons.js';
  import { getHero } from '../../shared/heroes/heroCatalog.js';

  // `labels` align with heroIds and are added to the tooltips. `scroll` keeps one line and scrolls.
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
