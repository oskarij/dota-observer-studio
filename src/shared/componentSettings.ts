import { isRecord } from './validation.js';
import { validPartialSettings } from './configValidation.js';
import {
  createDefaultComponentOptions,
  isOptionsFor,
  type ComponentOptions,
  type ComponentOptionsById
} from './componentOptions.js';
import { OVERLAY_ELEMENT_DEFINITIONS, SERIES_INFO_ELEMENTS } from './overlayElementCatalog.js';

export type ComponentAnchorX = 'left' | 'center' | 'right';
export type ComponentAnchorY = 'top' | 'center' | 'bottom';

export interface ComponentAnchor {
  x: ComponentAnchorX;
  y: ComponentAnchorY;
}

const ANCHOR_SHIFT: Record<ComponentAnchorX | ComponentAnchorY, string> = {
  left: '0',
  top: '0',
  center: '-50%',
  right: '-100%',
  bottom: '-100%'
};

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

export interface ElementBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function anchoredRegionLeft(
  anchorX: ComponentAnchorX,
  positionX: number,
  width: number
): number {
  if (anchorX === 'left') {
    return positionX;
  }
  if (anchorX === 'right') {
    return positionX - width;
  }
  return positionX - width / 2;
}

export function positionForAnchor(
  box: ElementBox,
  anchor: ComponentAnchor
): { x: number; y: number } {
  return {
    x: anchorPoint(anchor.x, box.x, box.width),
    y: anchorPoint(anchor.y, box.y, box.height)
  };
}

function anchorPoint(
  anchor: ComponentAnchorX | ComponentAnchorY,
  start: number,
  size: number
): number {
  if (anchor === 'center') {
    return Math.round(start + size / 2);
  }
  if (anchor === 'right' || anchor === 'bottom') {
    return Math.round(start + size);
  }
  return Math.round(start);
}

export function anchorShift(value: ComponentAnchorX | ComponentAnchorY): string {
  return ANCHOR_SHIFT[value] ?? '0';
}

// Position uses a 1920 × 1080 stage; size is a percentage.
export interface ComponentSettings {
  position: { x: number; y: number };
  anchor: ComponentAnchor;
  size: number;

  font: { family: string; weight: number; italic: boolean };
  color: string;
  shadow: { color: string; blur: number; offsetX: number; offsetY: number };
}

const DRAFT_SERIES_OVERRIDES: Record<string, Partial<ComponentSettings>> = {
  'team-name-radiant': { position: { x: 80, y: 550 }, anchor: { x: 'left', y: 'bottom' } },
  'team-name-dire': { position: { x: 1840, y: 550 }, anchor: { x: 'right', y: 'bottom' } },
  'team-logo-radiant': { position: { x: 80, y: 500 }, anchor: { x: 'left', y: 'bottom' } },
  'team-logo-dire': { position: { x: 1840, y: 500 }, anchor: { x: 'right', y: 'bottom' } },

  'series-score-radiant': { position: { x: 800, y: 550 }, anchor: { x: 'right', y: 'bottom' } },
  'series-score-dire': { position: { x: 1120, y: 550 }, anchor: { x: 'left', y: 'bottom' } }
};

const INGAME_SERIES_OVERRIDES: Record<string, Partial<ComponentSettings>> = {
  'team-name-radiant': { position: { x: 766, y: 48 }, anchor: { x: 'right', y: 'center' } },
  'team-name-dire': { position: { x: 1154, y: 48 }, anchor: { x: 'left', y: 'center' } },
  'team-logo-radiant': {
    position: { x: 844, y: 48 },
    anchor: { x: 'right', y: 'center' },
    size: 60
  },
  'team-logo-dire': { position: { x: 1076, y: 48 }, anchor: { x: 'left', y: 'center' }, size: 60 },
  'series-score-radiant': { position: { x: 934, y: 48 }, anchor: { x: 'right', y: 'center' } },
  'series-score-dire': { position: { x: 986, y: 48 }, anchor: { x: 'left', y: 'center' } }
};

const seriesInfoOverrides: Record<string, Partial<ComponentSettings>> = Object.fromEntries(
  SERIES_INFO_ELEMENTS.map((element) => {
    const key = `${element.kind}-${element.side}`;
    if (element.scope === 'draft') {
      return [element.id, DRAFT_SERIES_OVERRIDES[key] ?? {}];
    }
    return [element.id, { size: 63, ...INGAME_SERIES_OVERRIDES[key] }];
  })
);

const COMPONENT_SETTINGS_OVERRIDES: Record<string, Partial<ComponentSettings>> = {
  'fearless-draft': { position: { x: 960, y: 888 }, anchor: { x: 'center', y: 'top' } },

  'draft-board': { position: { x: 960, y: 567 }, anchor: { x: 'center', y: 'top' }, size: 100 },

  'player-names-radiant-draft': {
    position: { x: 80, y: 40 },
    anchor: { x: 'left', y: 'top' }
  },
  'player-names-dire-draft': {
    position: { x: 1840, y: 40 },
    anchor: { x: 'right', y: 'top' }
  },
  ...seriesInfoOverrides
};

export function createDefaultComponentSettings(id?: string): ComponentSettings {
  const base: ComponentSettings = {
    position: { x: 32, y: 1048 },
    anchor: { x: 'left', y: 'bottom' },
    size: 100,
    font: { family: 'RadianceOverlay', weight: 600, italic: false },
    color: '#f8fbff',
    shadow: { color: '#000000', blur: 4, offsetX: 2, offsetY: 2 }
  };

  const override = id === undefined ? undefined : COMPONENT_SETTINGS_OVERRIDES[id];
  const merged = override === undefined ? base : { ...base, ...override };

  return {
    ...merged,
    position: { ...merged.position },
    anchor: { ...merged.anchor },
    font: { ...merged.font },
    shadow: { ...merged.shadow }
  };
}

export interface OverlayConfig {
  enabled: Record<string, boolean>;
  settings: Record<string, ComponentSettings>;
  options: ComponentOptionsById;
  // The operator's stylesheet, applied after the bundled styles (docs/custom-styling.md).
  customCss: string;
}

export const CUSTOM_CSS_MAX_LENGTH = 100_000;

export function createDefaultOverlayConfig(): OverlayConfig {
  return {
    enabled: Object.fromEntries(
      OVERLAY_ELEMENT_DEFINITIONS.map((element) => [element.id, element.enabled])
    ),
    settings: Object.fromEntries(
      OVERLAY_ELEMENT_DEFINITIONS.map((element) => [
        element.id,
        createDefaultComponentSettings(element.id)
      ])
    ),
    options: createDefaultComponentOptions(),
    customCss: ''
  };
}

export function mergeOverlayConfigDefaults(input: unknown): OverlayConfig {
  const defaults = createDefaultOverlayConfig();
  if (
    !isRecord(input) ||
    !isRecord(input.enabled) ||
    !isRecord(input.settings) ||
    (input.options !== undefined && !isRecord(input.options))
  ) {
    throw new Error('Invalid overlay configuration.');
  }
  if (
    input.customCss !== undefined &&
    (typeof input.customCss !== 'string' || input.customCss.length > CUSTOM_CSS_MAX_LENGTH)
  ) {
    throw new Error('Custom CSS must be text of at most 100 000 characters.');
  }
  for (const enabled of Object.values(input.enabled)) {
    if (typeof enabled !== 'boolean') throw new Error('Invalid element visibility.');
  }
  for (const [id, settings] of Object.entries(input.settings)) {
    if (!validPartialSettings(settings)) throw new Error('Invalid settings for ' + id + '.');
  }
  for (const [id, value] of Object.entries(input.options ?? {})) {
    const base = defaults.options[id];
    if (
      base === undefined ||
      !isRecord(value) ||
      !Object.keys(value).every((key) => Object.hasOwn(base, key)) ||
      !isOptionsFor(id, { ...base, ...value })
    )
      throw new Error('Invalid options for ' + id + '.');
  }
  const config = input as {
    enabled: Record<string, boolean>;
    settings: Record<string, Partial<ComponentSettings>>;
    options?: Record<string, Partial<ComponentOptions>>;
    customCss?: string;
  };
  const settings = defaults.settings;
  for (const [id, value] of Object.entries(config.settings ?? {})) {
    const base = defaults.settings[id] ?? createDefaultComponentSettings(id);
    settings[id] = {
      ...base,
      ...value,
      position: { ...base.position, ...value.position },
      // A saved position without an anchor predates anchors and means top-left.
      anchor:
        value.position === undefined
          ? { ...base.anchor, ...value.anchor }
          : { x: 'left', y: 'top', ...value.anchor },
      font: { ...base.font, ...value.font },
      shadow: { ...base.shadow, ...value.shadow }
    };
  }

  const options = defaults.options;
  for (const [id, value] of Object.entries(config.options ?? {})) {
    options[id] = { ...defaults.options[id], ...value } as ComponentOptions;
  }

  return {
    enabled: { ...defaults.enabled, ...config.enabled },
    settings,
    options,
    customCss: config.customCss ?? ''
  };
}
