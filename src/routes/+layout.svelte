<script lang="ts">
  import AppSidebar from '$lib/components/app-sidebar.svelte';
  import { ModeWatcher } from 'mode-watcher';

  import '../styles/app.css';

  let { children } = $props();
</script>

<ModeWatcher />

<div class="flex min-h-svh">
  <AppSidebar />

  <main class="min-w-0 flex-1">
    {@render children()}
  </main>
</div>
