<script lang="ts">
  import ItalicIcon from '@lucide/svelte/icons/italic';
  import { onMount } from 'svelte';

  import type { ComponentSettings } from '../../shared/componentSettings.js';
  import {
    BUNDLED_FONTS,
    defaultWeightFor,
    fontHasItalic,
    fontLabel,
    fontWeights,
    weightLabel
  } from '../../shared/fontCatalog.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Slider } from '$lib/components/ui/slider/index.js';

  // settings is $bindable so the inputs below can mutate it via bind: with the page as co-owner
  // (avoids Svelte's ownership_invalid_mutation warning for cross-component prop mutation).
  let {
    name,
    settings = $bindable(),
    onReset
  }: {
    name?: string | undefined;
    settings?: ComponentSettings | undefined;
    onReset?: (() => void) | undefined;
  } = $props();

  // The user's installed fonts, loaded over the IPC bridge (empty in a plain browser).
  let systemFonts = $state<string[]>([]);

  onMount(async () => {
    const fonts = await globalThis.window?.dotaSpectatorTools?.fonts?.list?.();
    if (fonts) {
      systemFonts = fonts;
    }
  });

  // The weights the selected font ships, and whether it has italic faces.
  let weightOptions = $derived(settings ? fontWeights(settings.font.family) : []);
  let hasItalic = $derived(settings ? fontHasItalic(settings.font.family) : false);

  // Switching font: snap to a weight the new font has and drop italic if it has none,
  // so we never request a face the picker shows as unavailable.
  function setFamily(family: string): void {
    if (settings === undefined) {
      return;
    }

    settings.font.family = family;
    if (!fontWeights(family).some((weight) => weight.value === settings.font.weight)) {
      settings.font.weight = defaultWeightFor(family);
    }
    if (!fontHasItalic(family)) {
      settings.font.italic = false;
    }
  }

  // Reset swaps the trigger out for an inline confirm/cancel pair instead of a modal.
  let confirmingReset = $state(false);

  // Drop the pending confirmation when the user switches to a different component.
  $effect(() => {
    void name;
    confirmingReset = false;
  });

  function confirmReset(): void {
    onReset?.();
    confirmingReset = false;
  }
</script>

<div class="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
  <div class="flex h-12 shrink-0 items-center border-b px-4">
    <span class="text-base font-semibold">{name ? `${name} Settings` : 'Settings'}</span>
  </div>

  {#if settings === undefined}
    <div class="flex flex-1 items-center justify-center p-4">
      <span class="text-sm text-muted-foreground">Select a component to edit its settings.</span>
    </div>
  {:else}
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <!-- Position -->
      <section class="flex flex-col gap-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Position
        </span>
        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1 text-xs">
            <span class="text-muted-foreground">X</span>
            <Input type="number" bind:value={settings.position.x} />
          </label>
          <label class="flex flex-col gap-1 text-xs">
            <span class="text-muted-foreground">Y</span>
            <Input type="number" bind:value={settings.position.y} />
          </label>
        </div>
      </section>

      <!-- Size -->
      <section class="flex flex-col gap-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Size
        </span>
        <div class="flex items-center gap-3">
          <Slider type="single" min={10} max={300} step={1} bind:value={settings.size} />
          <span class="w-12 shrink-0 text-right text-sm tabular-nums">{settings.size}%</span>
        </div>
      </section>

      <!-- Font -->
      <section class="flex flex-col gap-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Font
        </span>
        <div class="flex flex-col gap-2">
          <div class="flex flex-col gap-1 text-xs">
            <span class="text-muted-foreground">Family</span>
            <Select.Root type="single" value={settings.font.family} onValueChange={setFamily}>
              <Select.Trigger class="h-8 w-full">
                <span
                  class="min-w-0 flex-1 truncate text-left"
                  style="font-family: '{settings.font.family}'"
                >
                  {fontLabel(settings.font.family)}
                </span>
              </Select.Trigger>
              <Select.Content class="max-h-64">
                <Select.Group>
                  <Select.GroupHeading>Overlay fonts</Select.GroupHeading>
                  {#each BUNDLED_FONTS as font (font.id)}
                    <Select.Item value={font.family} label={font.label}>
                      <span style="font-family: '{font.family}'">{font.label}</span>
                    </Select.Item>
                  {/each}
                </Select.Group>
                {#if systemFonts.length > 0}
                  <Select.Separator />
                  <Select.Group>
                    <Select.GroupHeading>System fonts</Select.GroupHeading>
                    {#each systemFonts as family (family)}
                      <Select.Item value={family} label={family}>
                        <span style="font-family: '{family}'">{family}</span>
                      </Select.Item>
                    {/each}
                  </Select.Group>
                {/if}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="flex items-end gap-2">
            <div class="flex min-w-0 flex-1 flex-col gap-1 text-xs">
              <span class="text-muted-foreground">Weight</span>
              <Select.Root
                type="single"
                value={String(settings.font.weight)}
                onValueChange={(value) => (settings.font.weight = Number(value))}
              >
                <Select.Trigger class="h-8 w-full">
                  <span class="min-w-0 flex-1 truncate text-left">
                    {weightLabel(settings.font.family, settings.font.weight)}
                  </span>
                </Select.Trigger>
                <Select.Content>
                  {#each weightOptions as weight (weight.value)}
                    <Select.Item value={String(weight.value)} label={weight.label} />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
            <Button
              variant={settings.font.italic ? 'default' : 'outline'}
              size="sm"
              class="h-8 shrink-0"
              disabled={!hasItalic}
              aria-pressed={settings.font.italic}
              title="Italic"
              onclick={() => (settings.font.italic = !settings.font.italic)}
            >
              <ItalicIcon class="size-4" />
              Italic
            </Button>
          </div>
        </div>
      </section>

      <!-- Color & Shadow -->
      <section class="flex flex-col gap-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Color & Shadow
        </span>
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="text-muted-foreground">Text color</span>
          <!-- No shadcn color picker exists; the native input is the only option. -->
          <input
            type="color"
            class="h-8 w-12 cursor-pointer rounded-md border bg-background"
            bind:value={settings.color}
          />
        </div>
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="text-muted-foreground">Shadow</span>
          <Popover.Root>
            <Popover.Trigger>
              {#snippet child({ props })}
                <Button {...props} variant="outline" class="h-8 gap-2 px-2 font-normal">
                  <span
                    class="size-4 shrink-0 rounded-sm border"
                    style="background-color: {settings.shadow.color}"
                  ></span>
                  Edit
                </Button>
              {/snippet}
            </Popover.Trigger>
            <!-- collisionPadding keeps an 8px gap from the window edges so the popover
                 shifts up with breathing room instead of sitting flush against the bottom. -->
            <Popover.Content
              side="right"
              align="start"
              sideOffset={8}
              collisionPadding={8}
              class="w-56"
            >
              <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Shadow
              </span>
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="text-muted-foreground">Color</span>
                <input
                  type="color"
                  class="h-8 w-12 cursor-pointer rounded-md border bg-background"
                  bind:value={settings.shadow.color}
                />
              </div>
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-muted-foreground">Blur</span>
                <Input type="number" min={0} bind:value={settings.shadow.blur} />
              </label>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex flex-col gap-1 text-xs">
                  <span class="text-muted-foreground">Offset X</span>
                  <Input type="number" bind:value={settings.shadow.offsetX} />
                </label>
                <label class="flex flex-col gap-1 text-xs">
                  <span class="text-muted-foreground">Offset Y</span>
                  <Input type="number" bind:value={settings.shadow.offsetY} />
                </label>
              </div>
            </Popover.Content>
          </Popover.Root>
        </div>
      </section>
    </div>

    {#if onReset}
      <div
        class="flex shrink-0 items-center gap-2 border-t p-3 {confirmingReset
          ? 'justify-end'
          : 'justify-center'}"
      >
        {#if confirmingReset}
          <span class="mr-auto text-xs text-muted-foreground">Reset to defaults?</span>
          <Button variant="ghost" size="xs" onclick={() => (confirmingReset = false)}>
            Cancel
          </Button>
          <Button variant="destructive" size="xs" onclick={confirmReset}>Reset</Button>
        {:else}
          <Button variant="ghost" size="xs" onclick={() => (confirmingReset = true)}>
            Reset to defaults
          </Button>
        {/if}
      </div>
    {/if}
  {/if}
</div>
