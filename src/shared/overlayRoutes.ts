import { OVERLAY_PHASES, type OverlayPhase } from './overlayElementCatalog.js';

// The URL contract between the overlay host, the overlay page, and the studio. The bundle is served
// under /overlay/, and each phase has its own page so OBS can load the draft scene and the in-game
// scene as two separate Browser sources. The bare /overlay/ still renders every element, so a source
// configured before the split keeps working.
export const OVERLAY_ROUTE = '/overlay';

// Path of the page that renders one phase, e.g. /overlay/draft/.
export function overlayScenePath(phase: OverlayPhase): string {
  return `${OVERLAY_ROUTE}/${phase}/`;
}

// The phase a served page renders, read from its own location. null means the bare /overlay/ (every
// element) — or a path that is not a page at all, which the host never serves as one.
export function resolveOverlayPhaseFromPath(pathname: string): OverlayPhase | null {
  const prefix = `${OVERLAY_ROUTE}/`;
  const trimmed = stripTrailingSlash(pathname);
  if (!trimmed.startsWith(prefix)) {
    return null;
  }

  const segment = trimmed.slice(prefix.length);
  return OVERLAY_PHASES.find((phase) => phase === segment) ?? null;
}

// Maps a request path on the overlay host to a file in the built bundle, or null for a 404. Every
// page path (bare and per-phase) serves the one index.html: its asset URLs are absolute under
// /overlay/assets/, so the same page works from any of them. The host hands over paths with the
// trailing slash already stripped (httpUtils.normalizePath), so both forms are accepted.
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
