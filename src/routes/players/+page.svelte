<script lang="ts">
  import { onMount } from 'svelte';

  import KnownPlayers from '$lib/components/known-players.svelte';
  import TeamsManager from '$lib/components/teams-manager.svelte';
  import { seriesState } from '$lib/state/seriesState.svelte.js';

  // The teams box guards deletion against the manual matchup, so this page needs the live series
  // snapshot too (teams saved from league tickets also appear here as they land).
  onMount(() => {
    void seriesState.load();
    return seriesState.listen();
  });
</script>

<svelte:head>
  <title>Teams &amp; Players | Observer Studio</title>
  <meta content="Team and known-player rosters for Dota Observer Studio." name="description" />
</svelte:head>

<section class="flex h-full min-h-0 flex-col p-6 max-sm:p-4">
  <!-- Roster library: teams beside the known-players list; stacks on narrow windows. -->
  <div class="mx-auto grid h-full min-h-0 w-full max-w-6xl gap-4 lg:grid-cols-2">
    <TeamsManager />
    <KnownPlayers />
  </div>
</section>
