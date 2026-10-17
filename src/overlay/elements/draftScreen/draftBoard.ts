import {
  type ComponentOptions,
  createDefaultDraftBoardOptions,
  type DraftBoardOptions,
  isDraftBoardOptions
} from '../../../shared/componentOptions.js';
import type { ComponentSettings } from '../../../shared/componentSettings.js';
import type { DotaGsiData, DraftSlot } from '../../../shared/dotaGsiPayload.js';
import {
  DRAFT_GAME_STATES,
  getDotaGsiMatchId,
  getDraftTeamSlots,
  getExpectedBanCount
} from '../../../shared/dotaGsiPayload.js';
import { getHero } from '../../../shared/heroes/heroCatalog.js';
import { DRAFT_BOARD_ID } from '../../../shared/overlayElementCatalog.js';

import type { OverlayElement, OverlayRenderOptions } from '../../overlayElement.js';
import { applyElementSettings } from '../../elementSettings.js';
import { getRequiredChild, setData, setHidden, setText } from '../../dom.js';
import { getHeroIconUrl } from '../fearlessDraft/heroIcons.js';

import { getHeroVideoUrl } from './heroVideos.js';
import { getHeroPosterUrl } from './heroPosters.js';
import { readDraftTimers, syncDraftTimers, type TimerSync } from './draftTimers.js';
import './draftBoard.css';

const DRAFT_STATE = 'DOTA_GAMERULES_STATE_HERO_SELECTION';

const PICK_SLOTS = 5;
const BAN_SLOTS = 7;

const TIMER_TICK_MS = 250;

export function mountDraftBoardElement(
  container: HTMLElement,
  { motion = 'animated', clock = 'live' }: OverlayRenderOptions = {}
): OverlayElement {
  const root = createDraftBoardRoot();
  root.dataset.motion = motion;
  container.append(root);

  const refs = {
    timer: getRequiredChild(root, '[data-db-timer]'),
    arrow: getRequiredChild(root, '[data-db-arrow]'),
    radiantReserve: getRequiredChild(root, '[data-db-reserve="radiant"]'),
    direReserve: getRequiredChild(root, '[data-db-reserve="dire"]'),
    radiantPicks: createSlots(
      getRequiredChild(root, '[data-db-picks="radiant"]'),
      PICK_SLOTS,
      'pick'
    ),
    direPicks: createSlots(getRequiredChild(root, '[data-db-picks="dire"]'), PICK_SLOTS, 'pick'),
    radiantBans: createSlots(getRequiredChild(root, '[data-db-bans="radiant"]'), BAN_SLOTS, 'ban'),
    direBans: createSlots(getRequiredChild(root, '[data-db-bans="dire"]'), BAN_SLOTS, 'ban')
  };

  let options: DraftBoardOptions = createDefaultDraftBoardOptions();
  let timerSync: TimerSync | null = null;
  let timerSampledAt = 0;
  let timerHandle: ReturnType<typeof setInterval> | null = null;
  let lastDraft: DotaGsiData | null = null;
  let lastMatchId: string | null = null;

  function setVisible(next: boolean): void {
    const changed = root.dataset.visible !== String(next);
    setData(root, 'visible', String(next));

    if (next && clock === 'live' && timerHandle === null) {
      timerHandle = setInterval(renderTimers, TIMER_TICK_MS);
    } else if (!next && timerHandle !== null) {
      clearInterval(timerHandle);
      timerHandle = null;
    }

    if (changed) {
      setPortraitsPlaying(next);
    }
  }

  function setPortraitsPlaying(playing: boolean): void {
    for (const slot of [...refs.radiantPicks, ...refs.direPicks]) {
      const video = slot.cell.querySelector('video');
      if (video === null) {
        continue;
      }
      if (playing) {
        const source = video.dataset.source;
        if (!video.hasAttribute('src') && source !== undefined) video.src = source;
        void video.play().catch(() => {});
      } else {
        video.pause();

        video.removeAttribute('src');
        video.load();
      }
    }
  }

  function renderDraft(gsiData: DotaGsiData): void {
    const radiant = getDraftTeamSlots(gsiData.draft, 'team2');
    const dire = getDraftTeamSlots(gsiData.draft, 'team3');

    applySlots(refs.radiantPicks, radiant.picks, motion);
    applySlots(refs.direPicks, dire.picks, motion);
    applySlots(refs.radiantBans, radiant.bans, motion);
    applySlots(refs.direBans, dire.bans, motion);

    const banCount = getExpectedBanCount(gsiData);
    setBanSlotCount(refs.radiantBans, banCount);
    setBanSlotCount(refs.direBans, banCount);

    const activeteam =
      gsiData.map?.game_state === DRAFT_STATE ? (gsiData.draft?.activeteam ?? null) : null;
    const isPick = gsiData.draft?.pick === true;
    setData(root, 'activeSide', activeSideName(activeteam));
    setText(refs.arrow, activeSideArrow(activeteam));

    markActiveSlot(refs.radiantPicks, activeteam === 2 && isPick);
    markActiveSlot(refs.direPicks, activeteam === 3 && isPick);
    markActiveSlot(refs.radiantBans, activeteam === 2 && !isPick);
    markActiveSlot(refs.direBans, activeteam === 3 && !isPick);

    timerSampledAt = performance.now();
    timerSync = syncDraftTimers(clock === 'live' ? timerSync : null, gsiData, timerSampledAt);
    renderTimers();
  }

  function renderTimers(): void {
    const figures = readDraftTimers(
      timerSync,
      clock === 'live' ? performance.now() : timerSampledAt
    );
    renderFigures(refs.timer, figures.remaining);
    renderFigures(refs.radiantReserve, figures.radiant);
    renderFigures(refs.direReserve, figures.dire);
  }

  return {
    id: DRAFT_BOARD_ID,
    applyOptions(next: ComponentOptions) {
      if (isDraftBoardOptions(next)) {
        options = next;
      }
    },
    applySettings(settings: ComponentSettings) {
      applyElementSettings(root, settings);
    },
    clear() {
      timerSync = null;
      lastDraft = null;
      lastMatchId = null;
      setVisible(false);
    },
    destroy() {
      setVisible(false);
      root.remove();
    },
    setEnabled(enabled) {
      setData(root, 'enabled', String(enabled));

      if (!enabled) {
        setVisible(false);
      }
    },
    update(gsiData: DotaGsiData) {
      const gameState = gsiData.map?.game_state;
      const matchId = getDotaGsiMatchId(gsiData);
      if (matchId !== lastMatchId) {
        lastDraft = null;
        timerSync = null;
      }
      lastMatchId = matchId;
      const inDraftPhase = gameState !== undefined && DRAFT_GAME_STATES.includes(gameState);
      const shouldShow =
        root.dataset.enabled !== 'false' &&
        inDraftPhase &&
        (gameState === DRAFT_STATE || options.showDuringStrategyTime);

      if (!inDraftPhase) lastDraft = null;
      else if (gsiData.draft !== undefined) lastDraft = gsiData;

      if (!shouldShow) {
        timerSync = null;
        setVisible(false);
        return;
      }

      renderDraft({
        ...gsiData,
        draft: gsiData.draft ?? (matchId === null ? {} : (lastDraft?.draft ?? {})),
        map: {
          ...lastDraft?.map,
          ...gsiData.map,
          paused: gsiData.map?.paused === true || gameState !== DRAFT_STATE
        }
      });
      setVisible(true);
    }
  };
}

interface SlotRef {
  readonly cell: HTMLElement;
  readonly kind: 'pick' | 'ban';
  heroKey: string;
}

function createSlots(row: HTMLElement, count: number, kind: 'pick' | 'ban'): SlotRef[] {
  const slots: SlotRef[] = [];
  for (let index = 0; index < count; index += 1) {
    const cell = document.createElement('div');
    cell.className = `draft-board__slot draft-board__slot--${kind}`;
    cell.dataset.filled = 'false';
    row.append(cell);
    slots.push({ cell, kind, heroKey: '' });
  }
  return slots;
}

function applySlots(
  slots: SlotRef[],
  draftSlots: DraftSlot[],
  motion: 'animated' | 'static'
): void {
  slots.forEach((slot, index) => {
    const draftSlot = draftSlots[index] ?? { heroId: null, heroClass: null };
    const heroKey =
      draftSlot.heroClass ?? (draftSlot.heroId === null ? '' : `#${draftSlot.heroId}`);
    if (slot.heroKey === heroKey) {
      return;
    }

    slot.heroKey = heroKey;
    slot.cell.dataset.filled = String(heroKey !== '');
    if (heroKey === '') slot.cell.replaceChildren();
    else slot.cell.replaceChildren(createSlotContent(draftSlot, slot.kind, motion));
  });
}

function createSlotContent(
  draftSlot: DraftSlot,
  kind: 'pick' | 'ban',
  motion: 'animated' | 'static'
): HTMLElement {
  const heroClass = draftSlot.heroClass;
  const hero = draftSlot.heroId === null ? undefined : getHero(draftSlot.heroId);
  const label = hero?.localizedName ?? heroClass ?? `#${draftSlot.heroId}`;

  const iconName = heroClass ?? hero?.internalName ?? null;

  if (kind === 'pick' && motion === 'static' && iconName !== null) {
    const posterUrl = getHeroPosterUrl(iconName);
    if (posterUrl !== null) {
      const image = document.createElement('img');
      image.className = 'draft-board__portrait';
      image.src = posterUrl;
      image.alt = label;
      return image;
    }
  }

  if (kind === 'pick' && motion === 'animated' && heroClass !== null) {
    const videoUrl = getHeroVideoUrl(heroClass);
    if (videoUrl !== null) {
      const video = document.createElement('video');
      video.className = 'draft-board__portrait';
      video.muted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.dataset.source = videoUrl;
      video.src = videoUrl;
      void video.play().catch(() => {});
      return video;
    }
  }

  const iconUrl = iconName === null ? null : getHeroIconUrl(iconName);
  if (iconUrl !== null) {
    const img = document.createElement('img');
    img.className = 'draft-board__portrait';
    img.src = iconUrl;
    img.alt = label;
    return img;
  }

  const fallback = document.createElement('span');
  fallback.className = 'draft-board__slot-fallback';
  fallback.textContent = label;
  return fallback;
}

function markActiveSlot(slots: SlotRef[], rowIsActive: boolean): void {
  const activeIndex = rowIsActive ? slots.findIndex((slot) => slot.heroKey === '') : -1;
  slots.forEach((slot, index) => {
    setData(slot.cell, 'active', String(index === activeIndex));
  });
}

function setBanSlotCount(slots: SlotRef[], count: number): void {
  slots.forEach((slot, index) => {
    setHidden(slot.cell, index >= count);
  });
}

function activeSideName(activeteam: number | null): string {
  if (activeteam === 2) {
    return 'radiant';
  }
  return activeteam === 3 ? 'dire' : 'none';
}

function activeSideArrow(activeteam: number | null): string {
  if (activeteam === 2) {
    return '❮';
  }
  return activeteam === 3 ? '❯' : '';
}

function renderFigures(host: HTMLElement, text: string): void {
  if (host.dataset.figures === text) {
    return;
  }
  host.dataset.figures = text;
  const cells: HTMLElement[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    const cell = document.createElement('span');
    cell.className =
      character === ':' ? 'draft-board__figure draft-board__figure--colon' : 'draft-board__figure';
    cell.textContent = character;
    cells.push(cell);
  }

  host.replaceChildren(...cells);
}

function createDraftBoardRoot(): HTMLElement {
  const root = document.createElement('section');
  root.id = 'draft-board';
  root.className = 'overlay-element draft-board';
  root.dataset.enabled = 'true';
  root.dataset.visible = 'false';
  root.setAttribute('aria-live', 'polite');
  root.innerHTML = `
    <div class="draft-board__picks">
      <div class="draft-board__pick-row" data-db-picks="radiant"></div>
      <div class="draft-board__center">
        <span class="draft-board__arrow" data-db-arrow></span>
        <span class="draft-board__timer" data-db-timer></span>
      </div>
      <div class="draft-board__pick-row" data-db-picks="dire"></div>
    </div>
    <div class="draft-board__bans">
      <div class="draft-board__ban-row" data-db-bans="radiant"></div>
      <div class="draft-board__reserves">
        <span class="draft-board__reserve" data-db-reserve="radiant"></span>
        <span class="draft-board__reserve" data-db-reserve="dire"></span>
      </div>
      <div class="draft-board__ban-row" data-db-bans="dire"></div>
    </div>
    <div class="draft-board__sides">
      <span class="draft-board__side-label">Radiant</span>
      <span class="draft-board__side-label">Dire</span>
    </div>
  `;

  return root;
}
