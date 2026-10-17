import type { HttpServerAddress } from './httpUtils.js';
import { createStaticFileHandler, type StaticFileHandler } from './staticFiles.js';

// User media (team logos) served at /media/ from a userData directory. Shared by the overlay and
// web hosts so both origins resolve the same root-relative logo URLs. The files are tiny and
// rarely fetched, so no-cache keeps them always fresh — including files dropped into the media
// dir by hand, which bypass the logo picker's timestamped (cache-busting) names.
export function createMediaFileHandler(
  mediaRoot: string,
  address: HttpServerAddress
): StaticFileHandler {
  return createStaticFileHandler({
    assetRoot: mediaRoot,
    address,
    resolveAssetPath: (requestPath) => {
      if (!requestPath.startsWith('/media/')) {
        return null;
      }

      const assetPath = requestPath.slice('/media/'.length);
      return assetPath.length === 0 ? null : assetPath;
    },
    cacheControl: () => 'no-cache',
    notFoundMessage: 'Media file not found',
    readErrorMessage: 'Unable to read media file'
  });
}
