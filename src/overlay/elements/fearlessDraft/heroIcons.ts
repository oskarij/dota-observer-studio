// Hero portraits keyed by internal name, resolved to bundled asset URLs at build time by Vite (the
// same asset-URL mechanism the rank medals use). The files are generated + committed by
// scripts/fetch-hero-assets.mjs. A missing icon resolves to null so the grid can fall back to a
// labelled placeholder instead of a broken image.
const iconModules = import.meta.glob<string>('./heroIcons/*.png', {
  eager: true,
  import: 'default',
  query: '?url'
});

const iconUrlsByInternalName: Record<string, string> = {};
for (const [path, url] of Object.entries(iconModules)) {
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  const internalName = fileName.slice(0, -'.png'.length);
  iconUrlsByInternalName[internalName] = url;
}

export function getHeroIconUrl(internalName: string): string | null {
  return iconUrlsByInternalName[internalName] ?? null;
}
