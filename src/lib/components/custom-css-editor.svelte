<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { CUSTOM_CSS_MAX_LENGTH } from '../../shared/componentSettings.js';

  let { css = $bindable('') }: { css?: string } = $props();

  let status = $state<string | null>(null);

  async function openMediaFolder(): Promise<void> {
    const result = await globalThis.window?.dotaSpectatorTools?.settings?.openMediaFolder();
    status = result?.ok === false ? (result.reason ?? null) : null;
  }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
  <div class="flex flex-col gap-1">
    <span class="text-base font-semibold">Custom CSS</span>
    <p class="text-xs text-muted-foreground">
      Restyles every element in both scenes, after the built-in styles. Elements share
      <span class="font-mono">.overlay-element</span>; each also has its own class, such as
      <span class="font-mono">.draft-board</span>, <span class="font-mono">.series-info</span> or
      <span class="font-mono">.selected-player</span>. Put fonts and images in the media folder and
      use them as <span class="font-mono">url(/media/file.woff2)</span>.
    </p>
  </div>
  <textarea
    class="min-h-0 w-full flex-1 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
    aria-label="Custom CSS"
    spellcheck="false"
    wrap="off"
    maxlength={CUSTOM_CSS_MAX_LENGTH}
    placeholder={'.draft-board {\n  --db-accent: #ffab53;\n  --db-active-image: url(/media/logo.svg);\n}'}
    bind:value={css}
  ></textarea>
  <div class="flex items-center justify-between gap-2">
    <Button size="sm" variant="outline" onclick={openMediaFolder}>Open media folder</Button>
    <span class="text-xs text-muted-foreground tabular-nums">
      {css.length.toLocaleString()} / {CUSTOM_CSS_MAX_LENGTH.toLocaleString()}
    </span>
  </div>
  {#if status !== null}
    <p role="alert" class="text-xs text-destructive">{status}</p>
  {/if}
</div>
