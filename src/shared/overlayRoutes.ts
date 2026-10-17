import { OVERLAY_PHASES, type OverlayPhase } from './overlayElementCatalog.js';

// The URL contract between the overlay host, the overlay page and the studio. Each phase has its
// own page under /overlay/, one OBS Browser source per scene. The bare /overlay/ renders every
// element.
export const OVERLAY_ROUTE = '/overlay';

export function overlayScenePath(phase: OverlayPhase): string {
  return `${OVERLAY_ROUTE}/${phase}/`;
}

// null for the bare /overlay/ and for paths that are not pages.
export function resolveOverlayPhaseFromPath(pathname: string): OverlayPhase | null {
  const prefix = `${OVERLAY_ROUTE}/`;
  const trimmed = stripTrailingSlash(pathname);
  if (!trimmed.startsWith(prefix)) {
    return null;
  }

  const segment = trimmed.slice(prefix.length);
  return OVERLAY_PHASES.find((phase) => phase === segment) ?? null;
}

// null for a 404. Every page path serves the one index.html, whose asset URLs are absolute under
// /overlay/assets/. Accepts paths with or without the trailing slash.
export function resolveOverlayAssetPath(requestPath: string): string | null {
  const trimmed = stripTrailingSlash(requestPath);
  if (trimmed === OVERLAY_ROUTE || resolveOverlayPhaseFromPath(trimmed) !== null) {
    return 'index.html';
  }

  const prefix = `${OVERLAY_ROUTE}/`;
  if (!requestPath.startsWith(prefix)) {
    return null;
  }

  return requestPath.slice(prefix.length);
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}
