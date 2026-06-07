<script lang="ts">
  import { overlayRoute, starterOverlayElements } from '$lib/overlayCatalog';

  const overlayUrl = `http://127.0.0.1:3333${overlayRoute}`;
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
    <a class="endpoint" href={overlayUrl}>
      {overlayUrl}
    </a>
  </section>

  <section aria-labelledby="elements-heading" class="panel">
    <div class="panel-header">
      <h2 id="elements-heading">Overlay Elements</h2>
      <span>{starterOverlayElements.length} configured</span>
    </div>

    <div class="overlay-grid">
      {#each starterOverlayElements as element (element.id)}
        <article class="overlay-card">
          <h3>{element.name}</h3>
          <p>{element.enabled ? 'enabled' : 'disabled'}</p>
        </article>
      {/each}
    </div>
  </section>
</main>
