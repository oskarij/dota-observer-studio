const { app, BrowserWindow } = require('electron');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createServer } = require('node:http');
const { writeFileSync } = require('node:fs');

app.setPath('userData', resolve('.dev/performance-electron'));
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const loadModule = (path) => import(pathToFileURL(resolve('build/electron', path)));
  const { createStaticFileHandler } = await loadModule('runtime/staticFiles.js');
  const { createOverlayGsiEventStream } = await loadModule('runtime/overlayGsiEventStream.js');
  const { resolveOverlayAssetPath } = await loadModule('shared/overlayRoutes.js');
  const { createDefaultOverlayConfig } = await loadModule('shared/componentSettings.js');
  const stream = createOverlayGsiEventStream();
  const common = {
    address: { host: '127.0.0.1', port: 0 },
    cacheControl: () => 'no-cache',
    connectEvents: stream.connect,
    notFoundMessage: 'missing',
    readErrorMessage: 'failed'
  };
  const assets = createStaticFileHandler({
    ...common,
    assetRoot: resolve('build/performance'),
    resolveAssetPath: (path) => (path === '/' ? 'index.html' : path.slice(1))
  });
  const overlay = createStaticFileHandler({
    ...common,
    assetRoot: resolve('build/overlay-assets/overlay'),
    resolveAssetPath: resolveOverlayAssetPath
  });
  const server = createServer((req, res) => {
    void (req.url.startsWith('/overlay') ? overlay : assets)(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let window = new BrowserWindow({
    show: false,
    useContentSize: true,
    width: 1920,
    height: 1080,
    webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true }
  });
  try {
    await window.loadURL(origin);
    const result = await window.webContents.executeJavaScript('window.runPerformanceChecks()');
    const config = createDefaultOverlayConfig();
    stream.setSettings(config);
    stream.setKnownPlayers([{ accountId: '123', name: 'Before', mmr: 5000, teamId: null }]);
    stream.setStatus('live');
    const payload = {
      map: { game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS' },
      hero: { team2: { player0: { selected_unit: true } } },
      player: { team2: { player0: { accountid: '123', name: 'Ingame' } } }
    };
    stream.broadcast(payload);
    await window.loadURL(`${origin}/overlay/ingame/`);
    async function expectView(expression, label) {
      for (let tries = 0; tries < 100; tries++) {
        if (await window.webContents.executeJavaScript(expression)) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      result.failures.push(label);
    }
    await expectView(
      `document.querySelector('[data-selected-player-name]')?.textContent === 'Before'`,
      'SSE did not replay the latest snapshot'
    );
    stream.setKnownPlayers([{ accountId: '123', name: 'After', mmr: 6000, teamId: null }]);
    await expectView(
      `document.querySelector('[data-selected-player-name]')?.textContent === 'After'`,
      'Profile SSE edit waited for a game tick'
    );
    config.options['selected-player'].showName = false;
    stream.setSettings(config);
    await expectView(
      `document.querySelector('[data-selected-player-name]')?.hidden === true`,
      'Settings SSE edit waited for a game tick'
    );
    stream.setStatus('stale');
    await expectView(
      `document.querySelector('#selected-player')?.dataset.visible === 'false'`,
      'Stale SSE feed did not clear overlay'
    );
    stream.setStatus('live');
    stream.broadcast(payload);
    await expectView(
      `document.querySelector('#selected-player')?.dataset.visible === 'true'`,
      'Unchanged payload did not restore live overlay'
    );
    result.metrics.liveSseChecks = 5;
    config.enabled['draft-board'] = true;
    stream.setSettings(config);
    await window.loadURL(`${origin}/overlay/draft/`);
    const emptyDraft = {
      map: { game_state: 'DOTA_GAMERULES_STATE_HERO_SELECTION' },
      draft: { activeteam: 2, pick: false, team2: { ban0_id: 0 }, team3: { ban0_id: 0 } }
    };
    stream.broadcast(emptyDraft);
    await expectView(
      `document.querySelector('#draft-board')?.dataset.visible === 'true'`,
      'Draft board waited for a completed ban when game mode was missing'
    );
    stream.broadcast({
      ...emptyDraft,
      map: { game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS' }
    });
    await expectView(
      `document.querySelector('#draft-board')?.dataset.visible === 'false'`,
      'Draft board remained visible outside the draft phase'
    );
    stream.broadcast({
      ...emptyDraft,
      map: { ...emptyDraft.map, game_mode: 'DOTA_GAMEMODE_AP' }
    });
    await expectView(
      `document.querySelector('#draft-board')?.dataset.visible === 'true'`,
      'Draft board still required a captains-style game mode'
    );
    result.metrics.draftVisibilityChecks = 3;
    const draftIds = [
      'draft-board',
      'fearless-draft',
      'player-names-radiant-draft',
      'team-name-radiant-draft',
      'team-logo-radiant-draft',
      'series-score-radiant-draft'
    ];
    for (const id of draftIds) config.enabled[id] = true;
    config.options['player-names-radiant-draft'].nameSource = 'ingame';
    stream.setSettings(config);
    stream.setFearlessSeries({ bannedHeroIds: [1, 2] });
    stream.setSeriesState({
      radiant: {
        name: 'Alpha',
        logoPath:
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
        score: 1
      },
      dire: { name: 'Beta', logoPath: null, score: 0 },
      seriesConfigured: true
    });
    const completeDraft = {
      map: { ...emptyDraft.map, matchid: '100' },
      player: { team2: { player0: { accountid: '123', name: 'Player' } } },
      draft: { activeteam: 2, activeteam_time_remaining: 20, team2: { pick0_id: 1 } }
    };
    stream.broadcast(completeDraft);
    await expectView(
      `document.querySelectorAll('#draft-board [data-filled="true"]').length === 1`,
      'Draft picks did not render'
    );
    for (const game_state of [
      'DOTA_GAMERULES_STATE_STRATEGY_TIME',
      'DOTA_GAMERULES_STATE_TEAM_SHOWCASE'
    ]) {
      stream.broadcast({
        map: { ...completeDraft.map, game_state },
        player: { team2: { player0: { accountid: '123', name: game_state } } }
      });
      await expectView(
        `${JSON.stringify(draftIds)}.every(id => document.getElementById(id)?.dataset.visible === 'true') && document.querySelector('#draft-board')?.dataset.activeSide === 'none' && document.querySelectorAll('#draft-board [data-filled="true"]').length === 1 && document.querySelector('#player-names-radiant-draft')?.textContent === ${JSON.stringify(game_state)}`,
        'Draft elements disappeared or lost picks in ' + game_state
      );
    }
    config.options['draft-board'].showDuringStrategyTime = false;
    stream.setSettings(config);
    await expectView(
      `document.querySelector('#draft-board')?.dataset.visible === 'false'`,
      'After-draft visibility option was ignored'
    );
    config.options['draft-board'].showDuringStrategyTime = true;
    stream.setSettings(config);
    await expectView(
      `document.querySelector('#draft-board')?.dataset.visible === 'true'`,
      'After-draft board could not be restored'
    );
    stream.broadcast({
      map: { ...completeDraft.map, matchid: '200' },
      player: completeDraft.player
    });
    await expectView(
      `document.querySelector('#draft-board')?.dataset.visible === 'true' && document.querySelectorAll('#draft-board [data-filled="true"]').length === 0`,
      'A new draft waited for draft data or retained the old match picks'
    );
    stream.broadcast({
      map: { ...completeDraft.map, game_state: 'DOTA_GAMERULES_STATE_PRE_GAME' }
    });
    await expectView(
      `${JSON.stringify(draftIds)}.every(id => document.getElementById(id)?.dataset.visible === 'false')`,
      'Draft elements remained visible in pre-game'
    );
    result.metrics.draftVisibilityChecks += 7;
    window.destroy();
    // A hidden native window can omit occluded video/image compositor layers from capturePage.
    // Render the visual artifact offscreen; keep the measured workloads above on the normal path.
    window = new BrowserWindow({
      show: false,
      width: 1920,
      height: 1080,
      useContentSize: true,
      webPreferences: {
        offscreen: true,
        backgroundThrottling: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    await window.loadURL(origin);
    await window.webContents.executeJavaScript('window.showPerformanceScene()');
    const assetsReady = await window.webContents.executeJavaScript(`(async () => {
      await document.fonts.load('40px RadianceOverlay');
      await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
      await Promise.all([...document.querySelectorAll('video')].map(video => new Promise(resolve => {
        if (video.readyState >= 2 || video.error) return resolve();
        video.addEventListener('loadeddata', resolve, { once: true });
        video.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 4000);
      })));
      // Seek to a decoded portrait frame instead of capturing the WebM's initial blank frame.
      await Promise.all([...document.querySelectorAll('video')].map(video => new Promise(resolve => {
        if (video.error || video.readyState < 2) return resolve();
        video.pause();
        video.addEventListener('seeked', resolve, { once: true });
        video.currentTime = Math.min(1, video.duration / 2);
        setTimeout(resolve, 3000);
      })));
      return { fonts: document.fonts.check('40px RadianceOverlay'),
        brokenImages: [...document.images].filter(image => !image.naturalWidth).length,
        unreadyVideos: [...document.querySelectorAll('video')].filter(video => video.readyState < 2).length };
    })()`);
    result.metrics.draftAssets = assetsReady;
    if (!assetsReady.fonts || assetsReady.brokenImages || assetsReady.unreadyVideos)
      result.failures.push('Draft assets failed to load');
    await window.webContents.executeJavaScript(
      'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
    );
    const screenshot = await window.webContents.capturePage();
    writeFileSync(resolve('.dev/performance-draft.png'), screenshot.toPNG());
    console.log(JSON.stringify(result, null, 2));
    writeFileSync(
      resolve(process.env.PERFORMANCE_REPORT ?? '.dev/performance-after.json'),
      JSON.stringify(result, null, 2)
    );
    stream.stop();
    server.close();
    app.exit(result.failures.length ? 1 : 0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
