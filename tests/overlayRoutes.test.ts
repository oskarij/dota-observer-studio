import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNetworkInfo, DEFAULT_NETWORK_SETTINGS } from '../src/shared/networkConfig.js';
import { OVERLAY_PHASES } from '../src/shared/overlayElementCatalog.js';
import {
  overlayScenePath,
  resolveOverlayAssetPath,
  resolveOverlayPhaseFromPath
} from '../src/shared/overlayRoutes.js';

// The overlay is two OBS Browser sources (draft + in-game) served from one bundle. These pin the URL
// contract between the host that serves the pages, the page that reads its own path to pick a
// phase, and the studio that advertises the URLs.

test('each phase page resolves back to its phase, with or without the trailing slash', () => {
  for (const phase of OVERLAY_PHASES) {
    const path = overlayScenePath(phase);
    assert.equal(resolveOverlayPhaseFromPath(path), phase);
    assert.equal(resolveOverlayPhaseFromPath(path.slice(0, -1)), phase);
  }
});

test('the bare overlay route and non-page paths resolve to no phase', () => {
  // The bare route renders every element.
  assert.equal(resolveOverlayPhaseFromPath('/overlay/'), null);
  assert.equal(resolveOverlayPhaseFromPath('/overlay'), null);
  assert.equal(resolveOverlayPhaseFromPath('/overlay/assets/index-abc.js'), null);
  assert.equal(resolveOverlayPhaseFromPath('/overlay/replay/'), null);
  assert.equal(resolveOverlayPhaseFromPath('/'), null);
});

test('every page path serves the bundle index, and assets map under /overlay/', () => {
  // The host strips the trailing slash before mapping (httpUtils.normalizePath); both forms work.
  const pagePaths = [
    '/overlay',
    '/overlay/',
    '/overlay/draft',
    '/overlay/draft/',
    '/overlay/ingame',
    '/overlay/ingame/'
  ];
  for (const path of pagePaths) {
    assert.equal(resolveOverlayAssetPath(path), 'index.html', path);
  }

  assert.equal(resolveOverlayAssetPath('/overlay/index.html'), 'index.html');
  assert.equal(resolveOverlayAssetPath('/overlay/assets/index-abc.js'), 'assets/index-abc.js');
});

test('paths outside the overlay route are not served', () => {
  assert.equal(resolveOverlayAssetPath('/'), null);
  assert.equal(resolveOverlayAssetPath('/overlays/index.html'), null);
  assert.equal(resolveOverlayAssetPath('/media/logo.png'), null);
});

test('the advertised browser-source URLs land on the phase pages the host serves', () => {
  const info = buildNetworkInfo(DEFAULT_NETWORK_SETTINGS, '192.168.1.20', true, {
    overlayHost: false,
    gsiListener: false
  });

  for (const phase of OVERLAY_PHASES) {
    const url = new URL(info.overlayUrls[phase]);
    assert.equal(url.host, '192.168.1.20:3333');
    assert.equal(url.pathname, overlayScenePath(phase));
    assert.equal(resolveOverlayAssetPath(url.pathname), 'index.html');
    assert.equal(resolveOverlayPhaseFromPath(url.pathname), phase);
  }
});
