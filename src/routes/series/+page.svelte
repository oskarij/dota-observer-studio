<script lang="ts">
  import { onMount } from 'svelte';

  import SeriesManual from '$lib/components/series-manual.svelte';
  import SeriesOverview from '$lib/components/series-overview.svelte';
  import TournamentBar from '$lib/components/tournament-bar.svelte';
  import { fearlessSeries } from '$lib/state/fearlessSeries.svelte.js';
  import { seriesState } from '$lib/state/seriesState.svelte.js';
  import { tournament } from '$lib/state/tournament.svelte.js';

  // Owned here so the overview's empty state can open the manual panel.
  let manualOpen = $state(false);

  onMount(() => {
    void seriesState.load();
    void tournament.load();
    void fearlessSeries.load();

    const stop = [seriesState.listen(), tournament.listen(), fearlessSeries.subscribe()];
    return () => stop.forEach((off) => off());
  });
</script>

<svelte:head>
  <title>Series | Observer Studio</title>
  <meta content="Tournament and series control for Dota Observer Studio." name="description" />
</svelte:head>

<section class="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-3 p-6 max-sm:p-4">
  <TournamentBar />
  <SeriesOverview onSetUpManually={() => (manualOpen = true)} />
  <SeriesManual bind:open={manualOpen} />
</section>
