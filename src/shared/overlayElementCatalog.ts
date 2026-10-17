// The two scenes a caster composes, each served to OBS as its own Browser source (the page paths
// live in overlayRoutes.ts). Every element belongs to exactly one phase: the studio lists elements
// one phase at a time, and a served page mounts only its own phase's elements.
export type OverlayPhase = 'draft' | 'ingame';

export const OVERLAY_PHASES: readonly OverlayPhase[] = ['draft', 'ingame'];

export const OVERLAY_PHASE_LABELS: Record<OverlayPhase, string> = {
  draft: 'Draft',
  ingame: 'In-game'
};

// Element ids referenced by the studio UI to branch on the selected component.
export const FEARLESS_DRAFT_ID = 'fearless-draft';
export const DRAFT_BOARD_ID = 'draft-board';

// The freely movable team-identity readouts (name/logo/score), all rendered from the series SSE
// payload. Each exists once per phase (draft + in-game) so a caster can place the same readout
// independently in a draft-screen layout and an in-game scorebug; each variant self-hides outside
// its phase.
export type SeriesInfoKind = 'team-name' | 'team-logo' | 'series-score';
export type SeriesInfoSide = 'radiant' | 'dire';
export type SeriesInfoScope = OverlayPhase;

export interface SeriesInfoElement {
  readonly id: string;
  // Label shown in the phase-filtered menu (no phase suffix, since the tab already names the phase).
  readonly menuLabel: string;
  readonly kind: SeriesInfoKind;
  readonly side: SeriesInfoSide;
  readonly scope: SeriesInfoScope;
}

const SERIES_INFO_BASES: { kind: SeriesInfoKind; side: SeriesInfoSide; label: string }[] = [
  { kind: 'team-name', side: 'radiant', label: 'Team Name (Radiant)' },
  { kind: 'team-name', side: 'dire', label: 'Team Name (Dire)' },
  { kind: 'team-logo', side: 'radiant', label: 'Team Logo (Radiant)' },
  { kind: 'team-logo', side: 'dire', label: 'Team Logo (Dire)' },
  { kind: 'series-score', side: 'radiant', label: 'Series Score (Radiant)' },
  { kind: 'series-score', side: 'dire', label: 'Series Score (Dire)' }
];

export const SERIES_INFO_ELEMENTS: SeriesInfoElement[] = SERIES_INFO_BASES.flatMap((base) =>
  OVERLAY_PHASES.map((scope) => ({
    id: `${base.kind}-${base.side}-${scope}`,
    menuLabel: base.label,
    kind: base.kind,
    side: base.side,
    scope
  }))
);

export interface OverlayElementDefinition {
  readonly id: string;
  readonly enabled: boolean;
  // Label for the phase-filtered menu (no phase suffix, since the tab already names the phase).
  readonly menuLabel: string;
  readonly phase: OverlayPhase;
}

export const PLAYER_NAMES_ELEMENTS = [
  { id: 'player-names-radiant-draft', side: 'radiant', label: 'Radiant' },
  { id: 'player-names-dire-draft', side: 'dire', label: 'Dire' }
] as const;

export type PlayerNamesElement = (typeof PLAYER_NAMES_ELEMENTS)[number];

const STANDALONE_DEFINITIONS: OverlayElementDefinition[] = [
  {
    enabled: true,
    id: 'selected-player',
    menuLabel: 'Selected Player',
    phase: 'ingame'
  },
  {
    enabled: true,
    id: FEARLESS_DRAFT_ID,
    menuLabel: 'Fearless Draft',
    phase: 'draft'
  },
  {
    // Pick/ban board for Captains Mode drafts; off by default so enabling it is a choice.
    enabled: false,
    id: DRAFT_BOARD_ID,
    menuLabel: 'Draft Board',
    phase: 'draft'
  }
];

export const OVERLAY_ELEMENT_DEFINITIONS: OverlayElementDefinition[] = [
  ...STANDALONE_DEFINITIONS,
  ...PLAYER_NAMES_ELEMENTS.map((element) => ({
    enabled: true,
    id: element.id,
    menuLabel: `Player Names (${element.label})`,
    phase: 'draft' as const
  })),
  ...SERIES_INFO_ELEMENTS.map((element) => ({
    enabled: false,
    id: element.id,
    menuLabel: element.menuLabel,
    phase: element.scope
  }))
];

// One row in the studio component menu. Standalone elements list as-is; each series-info kind
// collapses its radiant/dire pair into a single row — the row's toggle drives both element ids,
// and the settings panel tabs between the members. The per-side element ids (and their settings/
// enabled entries) are unchanged underneath.
export interface OverlayMenuEntry {
  readonly key: string;
  readonly menuLabel: string;
  readonly phase: OverlayPhase;
  readonly members: { readonly label: string; readonly id: string }[];
}

const SERIES_INFO_KINDS: { kind: SeriesInfoKind; menuLabel: string }[] = [
  { kind: 'team-name', menuLabel: 'Team Names' },
  { kind: 'team-logo', menuLabel: 'Team Logos' },
  { kind: 'series-score', menuLabel: 'Series Score' }
];

export const OVERLAY_MENU_ENTRIES: OverlayMenuEntry[] = [
  ...STANDALONE_DEFINITIONS.map((definition) => ({
    key: definition.id,
    menuLabel: definition.menuLabel,
    phase: definition.phase,
    members: [{ label: definition.menuLabel, id: definition.id }]
  })),
  {
    key: 'player-names-draft',
    menuLabel: 'Player Names',
    phase: 'draft',
    members: PLAYER_NAMES_ELEMENTS.map(({ id, label }) => ({ id, label }))
  },
  ...OVERLAY_PHASES.flatMap((scope) =>
    SERIES_INFO_KINDS.map(({ kind, menuLabel }) => ({
      key: `${kind}-${scope}`,
      menuLabel,
      phase: scope,
      members: (['radiant', 'dire'] as const).map((side) => ({
        label: side === 'radiant' ? 'Radiant' : 'Dire',
        id: `${kind}-${side}-${scope}`
      }))
    }))
  )
];
