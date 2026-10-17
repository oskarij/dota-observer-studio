import { DOTA_FONTS } from '../shared/fontCatalog.js';

const registered = new WeakSet<FontFaceSet>();

// Main copies the faces from this PC's Dota install to /media/dota-fonts/ (electron/dotaFonts.ts).
// Each face has its real weight, so a picked weight never gets a synthesized face. A face loads
// only when text uses it; without Dota it fails and the element falls back to sans-serif.
export function registerFontFaces(fonts: FontFaceSet): void {
  if (registered.has(fonts)) return;
  registered.add(fonts);

  for (const font of DOTA_FONTS) {
    for (const { value, label } of font.weights) {
      for (const italic of font.italic ? [false, true] : [false]) {
        const file = `${font.id}-${label.toLowerCase()}${italic ? 'italic' : ''}.otf`;
        fonts.add(
          new FontFace(font.family, `url(/media/dota-fonts/${file}) format('opentype')`, {
            weight: String(value),
            style: italic ? 'italic' : 'normal',
            display: 'swap'
          })
        );
      }
    }
  }
}
