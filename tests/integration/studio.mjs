import { app, BrowserWindow, ipcMain } from 'electron';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const profile = mkdtempSync(join(tmpdir(), 'observer-studio-test-'));
app.setPath('userData', profile);
app.on('window-all-closed', () => {});
const load = (file) => import(pathToFileURL(resolve(`build/electron/${file}.js`)).href);
const timeout = setTimeout(() => app.exit(1), 80_000);

app.whenReady().then(async () => {
  let window;
  let host;
  let stream;
  let session;
  let studio;
  let teamStore;
  let playerStore;
  let exitCode = 0;
  try {
    const { registerStudioServices } = await load('electron/studioServices');
    const { createTeamsStore } = await load('persistence/teamsStore');
    const { createKnownPlayersStore } = await load('persistence/knownPlayersStore');
    const { createSeriesStore } = await load('electron/seriesStore');
    const { createFearlessStore } = await load('electron/fearlessStore');
    const { createSettingsStore } = await load('electron/settingsStore');
    const { createWebHost } = await load('runtime/webHost');
    const { createOverlayGsiEventStream } = await load('runtime/overlayGsiEventStream');
    const { buildNetworkInfo, DEFAULT_NETWORK_SETTINGS } = await load('shared/networkConfig');
    const { registerSettingsIpc } = await load('electron/ipc/settings');
    const notify = (channel) => window?.webContents.send(channel);
    teamStore = createTeamsStore(':memory:');
    playerStore = createKnownPlayersStore(':memory:');
    teamStore.replaceAll([
      { id: 'a', name: 'Alpha', tag: 'A', logoPath: null, externalTeamId: 1 },
      { id: 'b', name: 'Beta', tag: 'B', logoPath: null, externalTeamId: 2 }
    ]);
    const fearless = createFearlessStore();
    stream = createOverlayGsiEventStream();
    let overlay;
    let picks = [];
    const history = [
      {
        matchId: '100',
        startTime: 1,
        radiantTeamId: 1,
        direTeamId: 2,
        radiantWin: true,
        seriesId: 10,
        seriesType: 1,
        heroIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      }
    ];
    let tournamentData = { matches: history };
    let apiKey = null;
    let failTeamWrites = false;
    let finishFetch;
    studio = registerStudioServices({
      eventStream: {
        ...stream,
        setSeriesState: (next) => {
          overlay = next;
          stream.setSeriesState(next);
        },
        setFearlessSeries: (next) => {
          picks = next.bannedHeroIds;
          stream.setFearlessSeries(next);
        }
      },
      teams: {
        ...teamStore,
        upsert: (team) => {
          if (failTeamWrites) throw new Error('Test storage unavailable');
          teamStore.upsert(team);
        }
      },
      players: playerStore,
      fearless,
      series: createSeriesStore(),
      tournament: {
        get: () => tournamentData,
        set: (next) => {
          tournamentData = next;
        },
        getApiKey: () => apiKey,
        setApiKey: (key) => {
          apiKey = key;
        }
      },
      valve: {
        fetchLeagueMatches: async () => ({ outcome: 'resolved', matches: history }),
        fetchMatchInfo: () =>
          new Promise((done) => {
            finishFetch = () =>
              done({ outcome: 'resolved', heroIds: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] });
          })
      },
      mediaRoot: join(profile, 'media'),
      broadcast: notify,
      schedule: () => () => {}
    });
    session = studio.session;
    const { roster } = studio;
    registerSettingsIpc(stream, join(profile, 'media'));
    ipcMain.handle('network:get', () =>
      buildNetworkInfo(DEFAULT_NETWORK_SETTINGS, '127.0.0.1', false, {
        overlayHost: false,
        gsiListener: false
      })
    );
    ipcMain.handle('fonts:list', () => []);
    const ticket = {
      map: { matchid: '200', game_state: 'DOTA_GAMERULES_STATE_HERO_SELECTION' },
      league: {
        league_id: 9,
        series_id: 10,
        name: 'Test Cup',
        radiant: { team_id: 1, name: 'Alpha', series_wins: 1 },
        dire: { team_id: 2, name: 'Beta', series_wins: 0 }
      }
    };
    session.handlePayload(ticket);
    host = createWebHost({
      assetRoot: resolve('build/web'),
      host: '127.0.0.1',
      port: 0,
      eventStream: stream
    });
    await host.start();
    window = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: {
        preload: resolve('build/electron/electron/preload.cjs'),
        sandbox: true,
        contextIsolation: true,
        backgroundThrottling: false,
        offscreen: true
      }
    });
    const errors = [];
    window.webContents.on('console-message', (details) => {
      if (details.level === 'error') errors.push(details.message);
    });
    const evaluate = (fn, value) =>
      window.webContents.executeJavaScript(`(${fn.toString()})(${JSON.stringify(value) ?? ''})`);
    const waitFor = (fn) =>
      window.webContents.executeJavaScript(`new Promise((done, reject) => {
    const check = () => (${fn.toString()})();
    if (check()) { done(); return; }
    const observer = new MutationObserver(() => { if (check()) { clearTimeout(timer); observer.disconnect(); done(); } });
    const timer = setTimeout(() => { observer.disconnect(); reject(new Error('UI condition timed out')); }, 8000);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
  })`);
    const click = (label) =>
      evaluate((label) => {
        const buttons = [...document.querySelectorAll('button')].filter(
          (button) => button.textContent.trim() === label
        );
        if (buttons.length !== 1 || buttons[0].disabled)
          throw new Error('Button unavailable: ' + label);
        buttons[0].click();
      }, label);
    const input = (selector, value, event = 'input') =>
      evaluate(
        ({ selector, value, event }) => {
          const control = document.querySelector(selector);
          assertControl(control);
          control.value = value;
          control.dispatchEvent(new Event(event, { bubbles: true }));
          function assertControl(control) {
            if (!control) throw new Error('Input unavailable');
          }
        },
        { selector, value, event }
      );
    const navigate = (path) => window.loadURL(`http://127.0.0.1:${host.port()}${path}`);
    await navigate('/');
    await waitFor(() =>
      [...document.querySelectorAll('button')].some(
        (button) => button.textContent.trim() === 'Team Names'
      )
    );
    await click('Team Names');
    await click('Live');

    await navigate('/players');
    await waitFor(() => document.querySelector('input[aria-label="Tag for Alpha"]'));
    teamStore.upsert({
      id: 'detected',
      name: 'Detected',
      tag: '',
      logoPath: null,
      externalTeamId: 500
    });
    teamStore.upsert({ ...teamStore.list().find((team) => team.id === 'a'), externalTeamId: 501 });
    await input('input[aria-label="Tag for Alpha"]', 'EDIT', 'change');
    await waitFor(() => document.querySelector('input[aria-label="Tag for Detected"]'));
    assert.ok(teamStore.list().some((team) => team.id === 'detected'));
    assert.equal(teamStore.list().find((team) => team.id === 'a').externalTeamId, 501);
    roster.addTeam({ id: 'pushed', name: 'Pushed', tag: '', logoPath: null, externalTeamId: null });
    await waitFor(() => document.querySelector('input[aria-label="Tag for Pushed"]'));
    failTeamWrites = true;
    await input('input[aria-label="Tag for Alpha"]', 'UNSAVED', 'change');
    await waitFor(() => document.body.textContent.includes('Test storage unavailable'));
    assert.equal(teamStore.list().find((team) => team.id === 'a').tag, 'EDIT');
    failTeamWrites = false;
    await input('input[aria-label="Tag for Alpha"]', 'SAVED', 'change');
    await waitFor(() => !document.body.textContent.includes('Test storage unavailable'));
    teamStore.upsert({ ...teamStore.list().find((team) => team.id === 'a'), externalTeamId: 1 });
    session.series.refresh();
    console.log(
      'PASS roster commands preserve automatic changes, notify the UI and show save failures'
    );

    await navigate('/series');
    await waitFor(() => document.querySelector('main .text-4xl'));
    await click('Manual controls');
    await waitFor(() => document.querySelector('button[aria-label="Increase score for Alpha"]'));
    await evaluate(() =>
      document.querySelector('button[aria-label="Increase score for Alpha"]').click()
    );
    await waitFor(() =>
      document.querySelector('main .text-4xl').textContent.replace(/\s/g, '').startsWith('2')
    );
    session.handlePayload(ticket);
    assert.equal(overlay.radiant.score, 2);
    assert.deepEqual(createSeriesStore().get().override, { 'valve:1': 2, 'valve:2': 0 });
    assert.equal(
      await evaluate(() => document.body.textContent.includes('Swap sides')),
      false,
      'the ticket decides the sides'
    );
    await click('Use automatic score');
    await waitFor(() => !document.body.textContent.includes('Score set manually'));
    assert.equal(overlay.radiant.score, 1);
    console.log('PASS manual score over the ticket, restore automatic score and persisted state');

    await click('Reset scores');
    await waitFor(() => document.body.textContent.includes('Score set manually'));
    session.handlePayload(ticket);
    assert.equal(overlay.radiant.name, 'Alpha');
    assert.equal(overlay.radiant.score, 0);
    assert.equal(overlay.dire.score, 0);
    await click('Use automatic score');
    await waitFor(() => !document.body.textContent.includes('Score set manually'));

    await click('Pick heroes');
    await waitFor(() => document.body.textContent.includes('Pick heroes manually'));
    await evaluate(() =>
      [...document.querySelectorAll('button[aria-pressed]')]
        .filter((button) => !button.disabled)
        .slice(0, 11)
        .forEach((button) => button.click())
    );
    await waitFor(() => document.body.textContent.includes('10 / 10 selected'));
    assert.equal(
      await evaluate(() => document.querySelectorAll('button[aria-pressed="true"]').length),
      10
    );
    await evaluate(() => document.querySelector('button[aria-pressed="true"]').click());
    await waitFor(() => document.body.textContent.includes('9 / 10 selected'));
    await evaluate(() =>
      document.querySelector('button[aria-pressed="false"]:not(:disabled)').click()
    );
    await click('Add 10 to series');
    await waitFor(() => !document.body.textContent.includes('Pick heroes manually'));
    assert.equal(fearless.getSeries().at(-1).heroIds.length, 10);
    await click('Use automatic picks');
    await waitFor(() => !document.body.textContent.includes('Picks set manually'));
    console.log(
      'PASS resetting scores preserves sides; hero picker caps at ten and saves successfully'
    );

    await click('Pick heroes');
    await waitFor(() => document.body.textContent.includes('Pick heroes manually'));
    await evaluate(() =>
      document.querySelector('button[aria-pressed="false"]:not(:disabled)').click()
    );
    await waitFor(() => document.body.textContent.includes('1 / 10 selected'));
    session.handlePayload({
      ...ticket,
      map: { ...ticket.map, matchid: '300' },
      league: { league_id: 9, series_id: 11 }
    });
    assert.deepEqual(fearless.getSeries(), []);
    assert.deepEqual(picks, []);
    assert.equal(overlay.radiant.name, '');
    await click('Add 1 to series');
    await waitFor(() => document.body.textContent.includes('The series changed'));
    assert.equal(
      await evaluate(() => document.body.textContent.includes('Pick heroes manually')),
      true
    );
    assert.deepEqual(fearless.getSeries(), []);
    await click('Cancel');
    await click('Pick heroes');
    await evaluate(() =>
      document.querySelector('button[aria-pressed="false"]:not(:disabled)').click()
    );
    await click('Add 1 to series');
    await waitFor(() => !document.body.textContent.includes('Pick heroes manually'));
    assert.equal(fearless.getSeries().length, 1);
    session.handlePayload(ticket);
    await session.tournament.refresh();
    await waitFor(() => document.querySelector('button[aria-label="Remove Game 1"]'));
    assert.deepEqual(
      fearless.getSeries().map((game) => game.matchId),
      ['100']
    );
    console.log(
      'PASS early series changes clear old teams and picks; stale picker shows its error and can be reopened'
    );

    await input('input[aria-label="Match ID to add"]', '150');
    await click('Add game');
    await waitFor(() =>
      [...document.querySelectorAll('button')].some((button) =>
        button.textContent.includes('Adding')
      )
    );
    await input('input[aria-label="Match ID to add"]', '250');
    assert.ok(finishFetch);
    finishFetch();
    await waitFor(() =>
      [...document.querySelectorAll('button')].some(
        (button) => button.textContent.trim() === 'Add game'
      )
    );
    assert.ok(fearless.getSeries().some((game) => game.matchId === '150'));
    assert.equal(
      await evaluate(() => document.querySelector('input[aria-label="Match ID to add"]').value),
      '250'
    );
    assert.ok(picks.includes(11));
    session.handlePayload(ticket);
    await session.tournament.refresh();
    assert.ok(
      createFearlessStore()
        .getSeries()
        .some((game) => game.matchId === '150')
    );
    await click('Use automatic picks');
    await waitFor(() => !document.body.textContent.includes('Picks set manually'));
    assert.deepEqual(
      fearless.getSeries().map((game) => game.matchId),
      ['100']
    );
    console.log(
      'PASS delayed match fetch preserves edited input; manual picks survive refresh and restart'
    );

    await input('input[aria-label="Match ID to add"]', '250');
    await click('Add game');
    await waitFor(() =>
      [...document.querySelectorAll('button')].some((button) =>
        button.textContent.includes('Adding')
      )
    );
    session.handlePayload({
      ...ticket,
      map: { ...ticket.map, matchid: '300' },
      league: { ...ticket.league, series_id: 11 }
    });
    finishFetch();
    await waitFor(() => document.body.textContent.includes('The series changed'));
    assert.deepEqual(fearless.getSeries(), []);
    console.log('PASS delayed match fetch cannot add to a different series');

    const settings = createSettingsStore();
    const before = settings.get();
    const rejected = await evaluate(() =>
      window.dotaSpectatorTools.settings.set({
        enabled: {},
        settings: { 'draft-board': null },
        options: {}
      })
    );
    assert.equal(rejected.ok, false);
    assert.deepEqual(createSettingsStore().get(), before);
    assert.deepEqual(errors, []);
    console.log('PASS invalid settings cannot poison persisted configuration; no renderer errors');
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    studio?.dispose();
    window?.destroy();
    stream?.stop();
    await host?.stop();
    teamStore?.close();
    playerStore?.close();
    clearTimeout(timeout);
    app.exit(exitCode);
  }
});
