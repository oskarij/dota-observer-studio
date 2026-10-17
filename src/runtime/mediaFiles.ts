import type { HttpServerAddress } from './httpUtils.js';
import { createStaticFileHandler, type StaticFileHandler } from './staticFiles.js';

// Serves the media folder at /media/ on both hosts. no-cache, because files dropped in by hand do
// not get the logo picker's cache-busting names.
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
