<script lang="ts">
  import * as Select from '$lib/components/ui/select/index.js';
  import TeamNameOptionsForm from '$lib/components/team-name-options.svelte';
  import { NAME_SOURCE_LABELS, type PlayerNamesOptions } from '../../shared/componentOptions.js';

  let { options = $bindable() }: { options?: PlayerNamesOptions | undefined } = $props();
</script>

{#if options}
  <section class="col-span-2 flex flex-col gap-2">
    <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Name source
    </span>
    <Select.Root
      type="single"
      value={options.nameSource}
      onValueChange={(value) => {
        if (options && (value === 'profile' || value === 'ingame')) {
          options.nameSource = value;
        }
      }}
    >
      <Select.Trigger class="w-full" aria-label="Player name source">
        {NAME_SOURCE_LABELS[options.nameSource]}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="profile" label={NAME_SOURCE_LABELS.profile}>
          {NAME_SOURCE_LABELS.profile}
        </Select.Item>
        <Select.Item value="ingame" label={NAME_SOURCE_LABELS.ingame}>
          {NAME_SOURCE_LABELS.ingame}
        </Select.Item>
      </Select.Content>
    </Select.Root>
  </section>
  <TeamNameOptionsForm bind:options />
{/if}
