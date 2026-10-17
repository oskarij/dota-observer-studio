// Animated hero portraits keyed by internal name, resolved to bundled asset URLs at build time by
// Vite (same mechanism as the fearless-draft hero icons). The webms are generated + committed (via
// Git LFS) by scripts/fetch-hero-assets.mjs. A missing video resolves to null so slots can fall
// back to the static hero icon.
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
