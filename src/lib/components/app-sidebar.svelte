<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
  import LayersIcon from '@lucide/svelte/icons/layers';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import SunIcon from '@lucide/svelte/icons/sun';
  import { toggleMode } from 'mode-watcher';

  const navigation = [
    { href: '/', label: 'Overlay', icon: LayersIcon },
    { href: '/components', label: 'Components', icon: LayoutGridIcon }
  ];

  const settings = { href: '/settings', label: 'Settings', icon: SettingsIcon };

  function isActive(href: string) {
    return page.url.pathname === href;
  }
</script>

{#snippet navItem(item: { href: string; label: string; icon: typeof LayersIcon })}
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
    <span>{item.label}</span>
  </a>
{/snippet}

<aside
  class="flex h-svh w-20 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-4"
>
  <a
    aria-label="Observer Studio"
    class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground"
    href={resolve('/')}
  >
    OS
  </a>

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
      <SunIcon
        class="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
      />
      <MoonIcon
        class="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
      />
    </button>

    {@render navItem(settings)}
  </div>
</aside>
