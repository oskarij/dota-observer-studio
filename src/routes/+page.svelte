<script lang="ts">
  import { starterOverlays } from '$lib/overlayCatalog';
</script>

<svelte:head>
  <title>Dota Spectator Tools</title>
  <meta
    content="Local overlay hosting platform for Dota spectator workflows."
    name="description"
  />
</svelte:head>

<main class="workspace">
  <section class="masthead">
    <div>
      <p class="eyebrow">Local overlay host</p>
      <h1>Dota Spectator Tools</h1>
    </div>
    <a class="endpoint" href="http://127.0.0.1:3333/overlay/main">
      http://127.0.0.1:3333/overlay/main
    </a>
  </section>

  <section aria-labelledby="overlays-heading" class="panel">
    <div class="panel-header">
      <h2 id="overlays-heading">Overlays</h2>
      <span>{starterOverlays.length} configured</span>
    </div>

    <div class="overlay-grid">
      {#each starterOverlays as overlay (overlay.id)}
        <article class="overlay-card">
          <h3>{overlay.name}</h3>
          <p>{overlay.route}</p>
        </article>
      {/each}
    </div>
  </section>
</main>
