import { createOverlayStage, applyOverlayConfigToStage } from '../../src/overlay/overlayStage.js';
import { createDefaultOverlayConfig } from '../../src/shared/componentSettings.js';
import {
  SAMPLE_GSI_DATA,
  SAMPLE_DRAFT_GSI_DATA,
  SAMPLE_KNOWN_PLAYERS,
  SAMPLE_BANNED_HERO_IDS,
  SAMPLE_SERIES_STATE
} from '../../src/lib/dev/sampleGsiData.js';
import { mount, unmount, tick } from 'svelte';
import PreviewHarness from './PreviewHarness.svelte';
import { getHeroPosterUrl } from '../../src/overlay/elements/draftScreen/heroPosters.js';

function stageRoot(): HTMLElement {
  const node = document.getElementById('stage');
  if (node === null) throw new Error('Missing benchmark stage');
  return node;
}
const root = stageRoot();
const config = createDefaultOverlayConfig();
for (const id of Object.keys(config.enabled)) config.enabled[id] = true;
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 100));

async function runPerformanceChecks() {
  const failures: string[] = [];
  const metrics: Record<string, unknown> = {};
  for (const phase of ['ingame', 'draft'] as const) {
    const stage = createOverlayStage(root, phase);
    applyOverlayConfigToStage(stage, config);
    stage.applyKnownPlayers(SAMPLE_KNOWN_PLAYERS);
    stage.applySeriesState(SAMPLE_SERIES_STATE);
    stage.applyFearlessSeries({ bannedHeroIds: [...SAMPLE_BANNED_HERO_IDS] });
    const data = phase === 'ingame' ? SAMPLE_GSI_DATA : SAMPLE_DRAFT_GSI_DATA;
    stage.update(data);
    await document.fonts.ready;
    await settle();
    if (phase === 'draft') {
      if (root.querySelectorAll('video[src]').length !== 5)
        failures.push('OBS draft lost its animated portraits');
      if (
        !root
          .getAnimations({ subtree: true })
          .some((animation) => animation.playState === 'running')
      )
        failures.push('OBS draft lost its breathing animation');
    }
    const observer = new MutationObserver(() => {});
    observer.observe(root, {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: true
    });
    const start = performance.now();
    for (let i = 0; i < 600; i++) stage.update(structuredClone(data));
    const elapsed = performance.now() - start;
    const mutations = observer.takeRecords().length;
    metrics[phase] = { updates: 600, elapsedMs: elapsed, mutations };
    if (mutations !== 0) failures.push(`${phase}: ${mutations} redundant DOM mutations`);
    const originalImages = [...root.querySelectorAll('img')];
    stage.applyFearlessSeries({ bannedHeroIds: [...SAMPLE_BANNED_HERO_IDS] });
    stage.update(data);
    if (originalImages.some((image) => !root.contains(image)))
      failures.push(`${phase}: unchanged images were recreated`);

    if (phase === 'ingame') {
      const changed = structuredClone(data);
      const nextPlayer = changed.player?.team2?.player0;
      if (nextPlayer !== undefined && changed.hero?.team2?.player0 !== undefined) {
        for (const side of Object.values(changed.hero)) {
          for (const hero of Object.values(side ?? {}))
            if (hero) Object.assign(hero, { selected_unit: false });
        }
        Object.assign(changed.hero.team2.player0, { selected_unit: true });
        Object.assign(nextPlayer, { name: 'Selection changed' });
        stage.applyOptions('selected-player', {
          showName: true,
          showMedal: false,
          nameSource: 'ingame',
          rankValue: 'hidden'
        });
        stage.update(changed);
        if (root.querySelector('[data-selected-player-name]')?.textContent !== 'Selection changed')
          failures.push('Selection change did not render');
      }
    }
    observer.disconnect();
    stage.clear();
    await settle();
    const playing = [...root.querySelectorAll('video')].filter((video) => !video.paused).length;
    const loadedVideos = root.querySelectorAll('video[src]').length;
    const animations = root
      .getAnimations({ subtree: true })
      .filter((animation) => animation.playState === 'running').length;
    metrics[`${phase}Cleared`] = {
      playingVideos: playing,
      loadedVideos,
      runningAnimations: animations
    };
    if (playing || loadedVideos || animations)
      failures.push(`${phase}: hidden media or animations still running`);
    if (phase === 'draft') {
      stage.update(data);
      if (root.querySelectorAll('video[src]').length === 0)
        failures.push('Draft portraits did not reload on resume');
    }
    stage.destroy();
  }
  const preview = mount(PreviewHarness, { target: root });
  await tick();
  preview.update(structuredClone(SAMPLE_GSI_DATA));
  await tick();
  await settle();
  let previewMutations = 0;
  const previewObserver = new MutationObserver((records) => {
    previewMutations += records.length;
  });
  previewObserver.observe(root, {
    subtree: true,
    attributes: true,
    childList: true,
    characterData: true
  });
  const previewStart = performance.now();
  // A tick between packets exercises Svelte's real effects (a synchronous burst would coalesce).
  for (let i = 0; i < 600; i++) {
    preview.update(structuredClone(SAMPLE_GSI_DATA));
    await tick();
    previewMutations += previewObserver.takeRecords().length;
  }
  metrics.preview = {
    updates: 600,
    elapsedMs: performance.now() - previewStart,
    mutations: previewMutations
  };
  if (previewMutations) failures.push(`Preview: ${previewMutations} redundant mutations`);
  previewObserver.disconnect();
  preview.rename();
  preview.move();
  await tick();
  if (root.querySelector('[data-selected-player-name]')?.textContent !== 'Updated profile')
    failures.push('Preview profile edit did not render');
  if (
    root.querySelector<HTMLElement>('#selected-player')?.style.getPropertyValue('--el-x') !==
    '500px'
  )
    failures.push('Preview settings edit did not render');
  preview.toggle(false);
  await tick();
  if (root.querySelector<HTMLElement>('#selected-player')?.dataset.visible !== 'false')
    failures.push('Disabled preview element stayed visible');
  preview.toggle(true);
  preview.update(null);
  await tick();
  if (root.querySelector<HTMLElement>('#selected-player')?.dataset.visible !== 'false')
    failures.push('Stale preview element stayed visible');

  // Simulate the Page Visibility event emitted by Electron on minimize; check teardown and replay.
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await tick();
  if (root.querySelector('#selected-player') !== null)
    failures.push('Hidden preview still mounted');
  preview.update(structuredClone(SAMPLE_GSI_DATA));
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  document.dispatchEvent(new Event('visibilitychange'));
  await tick();
  if (root.querySelector('[data-selected-player-name]')?.textContent !== 'Updated profile')
    failures.push('Restored preview lost current state');
  Reflect.deleteProperty(document, 'hidden');
  preview.draft(true);
  await tick();
  await Promise.all([...root.querySelectorAll('img')].map((image) => image.decode()));
  await settle();
  if (root.querySelectorAll('.draft-board__slot--pick img').length !== 5)
    failures.push('Static draft did not render all five portrait frames');
  if (root.querySelector('video') !== null) failures.push('Studio draft created a video decoder');
  if (root.getAnimations({ subtree: true }).some((animation) => animation.playState === 'running'))
    failures.push('Studio draft kept an animation running');
  const sampleTimer = root.querySelector('[data-db-timer]')?.textContent;
  let idleMutations = 0;
  const idleObserver = new MutationObserver((records) => {
    idleMutations += records.length;
  });
  idleObserver.observe(root, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true
  });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  idleMutations += idleObserver.takeRecords().length;
  idleObserver.disconnect();
  metrics.staticSample = {
    idleMs: 1200,
    mutations: idleMutations,
    videos: root.querySelectorAll('video').length
  };
  if (idleMutations !== 0 || root.querySelector('[data-db-timer]')?.textContent !== sampleTimer)
    failures.push('Sample draft continued updating while idle');

  // Switching sources must re-enable the informational clock without restoring motion.
  preview.draft(false);
  await tick();
  const liveTimer = root.querySelector('[data-db-timer]')?.textContent;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  if (root.querySelector('[data-db-timer]')?.textContent === liveTimer)
    failures.push('Live draft timer stopped updating');
  const nextDraft = structuredClone(SAMPLE_DRAFT_GSI_DATA);
  Object.assign(nextDraft.draft?.team2 ?? {}, { pick0_class: 'axe', pick0_id: 2 });
  preview.update(nextDraft);
  await tick();
  if (
    root.querySelector('.draft-board__slot--pick img')?.getAttribute('src') !==
    getHeroPosterUrl('axe')
  )
    failures.push('Live hero change did not update the static portrait');
  preview.draft(true);
  await tick();
  if (root.querySelector('[data-db-timer]')?.textContent !== sampleTimer)
    failures.push('Returning to Sample did not restore its timer');
  if (
    root.querySelector('video') !== null ||
    root.getAnimations({ subtree: true }).some((a) => a.playState === 'running')
  )
    failures.push('Source switching restored preview motion');
  await unmount(preview);

  // Every bundled animated portrait needs a decodable static equivalent.
  const videoFiles = Object.keys(
    import.meta.glob('../../src/overlay/elements/draftScreen/heroVideos/*.webm')
  );
  await Promise.all(
    videoFiles.map(async (file) => {
      const name = file.slice(file.lastIndexOf('/') + 1, -'.webm'.length);
      const url = getHeroPosterUrl(name);
      if (url === null) {
        failures.push(`Missing portrait frame: ${name}`);
        return;
      }
      const poster = new Image();
      poster.src = url;
      try {
        await poster.decode();
      } catch {
        failures.push(`Invalid portrait frame: ${name}`);
      }
    })
  );
  metrics.staticPortraitsChecked = videoFiles.length;
  return { metrics, failures };
}

function showPerformanceScene(): void {
  const stage = createOverlayStage(root, 'draft');
  applyOverlayConfigToStage(stage, config);
  stage.applyKnownPlayers(SAMPLE_KNOWN_PLAYERS);
  stage.applyFearlessSeries({ bannedHeroIds: [...SAMPLE_BANNED_HERO_IDS] });
  stage.applySeriesState(SAMPLE_SERIES_STATE);
  stage.update(SAMPLE_DRAFT_GSI_DATA);
}

Object.assign(window, { runPerformanceChecks, showPerformanceScene });
