<script lang="ts">
  import OverlayPreview from '../../src/lib/components/overlay-preview.svelte';
  import { createDefaultOverlayConfig } from '../../src/shared/componentSettings.js';
  import type { DotaGsiData } from '../../src/shared/dotaGsiPayload.js';
  import type { OverlayPhase } from '../../src/shared/overlayElementCatalog.js';
  import {
    SAMPLE_GSI_DATA,
    SAMPLE_DRAFT_GSI_DATA,
    SAMPLE_KNOWN_PLAYERS,
    SAMPLE_SERIES_STATE
  } from '../../src/lib/dev/sampleGsiData.js';

  let data = $state.raw<DotaGsiData | null>(SAMPLE_GSI_DATA);
  const config = $state(createDefaultOverlayConfig());
  let players = $state.raw([...SAMPLE_KNOWN_PLAYERS]);
  let phase = $state<OverlayPhase>('ingame');
  export function draft(sample: boolean) {
    config.enabled['draft-board'] = true;
    phase = 'draft';
    data = sample ? SAMPLE_DRAFT_GSI_DATA : globalThis.structuredClone(SAMPLE_DRAFT_GSI_DATA);
  }
  export function update(next: DotaGsiData | null) {
    data = next;
  }
  export function rename() {
    players = players.map((player) => ({ ...player, name: 'Updated profile' }));
  }
  export function move() {
    const settings = config.settings['selected-player'];
    if (settings !== undefined) settings.position.x = 500;
  }
  export function toggle(enabled: boolean) {
    config.enabled['selected-player'] = enabled;
  }
</script>

<OverlayPreview
  gsiData={data}
  knownPlayers={players}
  enabled={config.enabled}
  settings={config.settings}
  options={config.options}
  seriesState={SAMPLE_SERIES_STATE}
  {phase}
/>
