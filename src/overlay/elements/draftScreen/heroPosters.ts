// Still frames of the hero videos, from tools/generate-hero-posters.mjs. The studio preview shows
// these, so it opens no video decoders.
const posterModules = import.meta.glob<string>('./heroPosters/*.webp', {
  eager: true,
  import: 'default',
  query: '?url'
});

const posterUrlsByInternalName: Record<string, string> = {};
for (const [path, url] of Object.entries(posterModules)) {
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  posterUrlsByInternalName[fileName.slice(0, -'.webp'.length)] = url;
}

export function getHeroPosterUrl(internalName: string): string | null {
  return posterUrlsByInternalName[internalName] ?? null;
}
