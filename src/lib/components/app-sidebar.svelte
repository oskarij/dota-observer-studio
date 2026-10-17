<script lang="ts">
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { Pathname } from '$app/types';
  import LayersIcon from '@lucide/svelte/icons/layers';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import SunIcon from '@lucide/svelte/icons/sun';
  import SwordsIcon from '@lucide/svelte/icons/swords';
  import UsersIcon from '@lucide/svelte/icons/users';
  import { toggleMode } from 'mode-watcher';

  const navigation: { href: Pathname; label: string; icon: typeof LayersIcon }[] = [
    { href: '/', label: 'Overlay', icon: LayersIcon },
    { href: '/series', label: 'Series', icon: SwordsIcon },
    { href: '/players', label: 'Teams & Players', icon: UsersIcon }
  ];

  const settings: { href: Pathname; label: string; icon: typeof LayersIcon } = {
    href: '/settings',
    label: 'Settings',
    icon: SettingsIcon
  };

  function isActive(href: string) {
    return page.url.pathname === href;
  }
</script>

{#snippet navItem(item: { href: Pathname; label: string; icon: typeof LayersIcon })}
  {@const active = isActive(item.href)}
  <a
    aria-current={active ? 'page' : undefined}
    class="flex w-full flex-col items-center gap-1.5 rounded-lg py-2.5 text-[0.6875rem] font-medium transition-colors
      {active
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}"
    href={resolve(item.href)}
  >
    <item.icon class="size-5 shrink-0" />
    <span class="text-center leading-tight">{item.label}</span>
  </a>
{/snippet}

<aside
  class="flex h-svh w-20 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-4"
>
  <img
    src={asset('/logo.png')}
    alt="Observer Studio"
    class="size-12 shrink-0 rounded-lg object-cover"
  />

  <nav class="mt-6 flex w-full flex-col gap-1 px-2">
    {#each navigation as item (item.href)}
      {@render navItem(item)}
    {/each}
  </nav>

  <div class="mt-auto flex w-full flex-col items-center gap-1 px-2">
    <button
      aria-label="Toggle theme"
      class="relative flex size-10 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      onclick={toggleMode}
      type="button"
    >
      <SunIcon class="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <MoonIcon
        class="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
      />
    </button>

    {@render navItem(settings)}
  </div>
</aside>
