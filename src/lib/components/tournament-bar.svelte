<script lang="ts">
  import RefreshIcon from '@lucide/svelte/icons/refresh-cw';

  import { Button } from '$lib/components/ui/button/index.js';
  import { tournament } from '$lib/state/tournament.svelte.js';

  let status = $state<string | null>(null);

  let league = $derived(tournament.state?.league ?? null);
  let notice = $derived(status ?? tournament.error ?? tournament.state?.message ?? null);
</script>

<div class="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 shadow-sm">
  <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
    <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      League
    </span>
    {#if league === null}
      <span class="min-w-0 flex-1 text-sm text-muted-foreground">
        Detected from the lobby's league ticket when you spectate one.
      </span>
    {:else}
      <span class="min-w-0 flex-1 truncate text-sm font-medium">{league.name}</span>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={tournament.busy}
        aria-label="Refresh match history"
        onclick={async () => {
          status = await tournament.refresh();
        }}
      >
        <RefreshIcon class={tournament.busy ? 'animate-spin' : ''} />
      </Button>
    {/if}
  </div>

  {#if notice !== null}
    <p role="status" class="text-xs text-destructive">{notice}</p>
  {/if}
</div>
