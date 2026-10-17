// Valve's fonts, read from this PC's Dota install (overlay/fontFaces.ts). A weight's label in
// lowercase is part of its file name, e.g. radiance-semibold.otf, so `weights` lists only faces
// that exist in the install.
export interface FontWeightOption {
  readonly value: number;
  readonly label: string;
}

export interface DotaFontDefinition {
  readonly id: string;
  readonly label: string;
  readonly family: string;
  readonly weights: FontWeightOption[];
  readonly defaultWeight: number;
  readonly italic: boolean;
}

const WEIGHT_LABELS: Record<number, string> = {
  200: 'Ultralight',
  300: 'Light',
  400: 'Regular',
  600: 'Semibold',
  700: 'Bold'
};

function weights(values: number[]): FontWeightOption[] {
  return values.map((value) => ({ value, label: WEIGHT_LABELS[value] ?? String(value) }));
}

// Weights offered for an arbitrary system font, where we can't know which faces exist.
export const SYSTEM_FONT_WEIGHTS: FontWeightOption[] = weights([400, 700]);

export const DOTA_FONTS: DotaFontDefinition[] = [
  {
    id: 'radiance',
    label: 'Radiance',
    family: 'RadianceOverlay',
    weights: weights([200, 300, 400, 600, 700]),
    defaultWeight: 600,
    italic: true
  },
  {
    id: 'reaver',
    label: 'Reaver',
    family: 'ReaverOverlay',
    weights: weights([300, 400, 600, 700]),
    defaultWeight: 700,
    italic: false
  }
];

function dotaFont(family: string): DotaFontDefinition | undefined {
  return DOTA_FONTS.find((font) => font.family === family);
}

export function fontLabel(family: string): string {
  return dotaFont(family)?.label ?? family;
}

export function fontWeights(family: string): FontWeightOption[] {
  return dotaFont(family)?.weights ?? SYSTEM_FONT_WEIGHTS;
}

export function weightLabel(family: string, value: number): string {
  return fontWeights(family).find((weight) => weight.value === value)?.label ?? String(value);
}

// Dota fonts declare whether italic faces exist; system fonts are assumed to.
export function fontHasItalic(family: string): boolean {
  return dotaFont(family)?.italic ?? true;
}

// Weight to fall back to when switching to a font that lacks the current one.
export function defaultWeightFor(family: string): number {
  return dotaFont(family)?.defaultWeight ?? 400;
}
