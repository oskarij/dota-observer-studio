// Animated hero portraits by internal name, from tools/fetch-hero-assets.mjs (stored in Git LFS).
// null when a hero has no video; the slot then shows the hero icon.
const videoModules = import.meta.glob<string>('./heroVideos/*.webm', {
  eager: true,
  import: 'default',
  query: '?url'
});

const videoUrlsByInternalName: Record<string, string> = {};
for (const [path, url] of Object.entries(videoModules)) {
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  const internalName = fileName.slice(0, -'.webm'.length);
  videoUrlsByInternalName[internalName] = url;
}

export function getHeroVideoUrl(internalName: string): string | null {
  return videoUrlsByInternalName[internalName] ?? null;
}
