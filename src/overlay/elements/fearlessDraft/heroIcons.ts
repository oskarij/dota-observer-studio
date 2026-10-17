// Hero icons by internal name, from tools/fetch-hero-assets.mjs. null when a hero has no icon.
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
