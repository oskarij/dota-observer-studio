import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

import { logWarning } from '../shared/logger.js';
import { NETWORK_HOST } from '../shared/networkConfig.js';

const execFileAsync = promisify(execFile);

// Observer Studio's own cfg file, named so it won't collide with other GSI tools' configs.
const CONFIG_FILE_NAME = 'gamestate_integration_observer_studio.cfg';

// The tail from a Steam library root to the folder Dota reads GSI configs from.
const DOTA_CFG_RELATIVE = join('steamapps', 'common', 'dota 2 beta', 'game', 'dota', 'cfg');

// Locate `…/dota 2 beta/game/dota/cfg` by walking Steam's library folders. Returns null when Dota
// can't be found (caller then falls back to a folder picker).
export async function resolveDotaCfgDir(): Promise<string | null> {
  for (const steamRoot of await steamRootCandidates()) {
    for (const library of await steamLibraryPaths(steamRoot)) {
      const cfgDir = join(library, DOTA_CFG_RELATIVE);
      if (existsSync(cfgDir)) {
        return cfgDir;
      }
    }
  }

  return null;
}

// Writes the cfg into `<cfgDir>/gamestate_integration/`. Tolerates the user picking the
// `gamestate_integration` folder itself (a natural mistake) so we don't nest a second one inside it.
export async function writeGsiConfig(cfgDir: string, gsiPort: number): Promise<string> {
  const targetDir =
    basename(cfgDir).toLowerCase() === 'gamestate_integration'
      ? cfgDir
      : join(cfgDir, 'gamestate_integration');
  await mkdir(targetDir, { recursive: true });

  const filePath = join(targetDir, CONFIG_FILE_NAME);
  await writeFile(filePath, gsiConfigContents(gsiPort), 'utf8');
  return filePath;
}

async function steamRootCandidates(): Promise<string[]> {
  const candidates = new Set<string>();

  const fromRegistry = await steamPathFromRegistry();
  if (fromRegistry !== null) {
    candidates.add(fromRegistry);
  }

  // Common defaults as a fallback when the registry read fails (e.g. a portable install).
  candidates.add('C:\\Program Files (x86)\\Steam');
  candidates.add('C:\\Program Files\\Steam');

  return [...candidates].filter((path) => existsSync(path));
}

async function steamPathFromRegistry(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('reg', [
      'query',
      'HKCU\\Software\\Valve\\Steam',
      '/v',
      'SteamPath'
    ]);

    // A REG_SZ line looks like: "    SteamPath    REG_SZ    c:/program files (x86)/steam"
    const match = /SteamPath\s+REG_SZ\s+(.+)$/im.exec(stdout);
    if (match?.[1] === undefined) {
      return null;
    }

    // The registry stores forward slashes; normalize to a real Windows path.
    return match[1].trim().replace(/\//g, '\\');
  } catch (error) {
    logWarning('Could not read Steam path from the registry', error);
    return null;
  }
}

// Every library root listed in libraryfolders.vdf (Dota may live on a non-default drive), plus the
// Steam root itself as a fallback.
async function steamLibraryPaths(steamRoot: string): Promise<string[]> {
  const paths = new Set<string>([steamRoot]);

  try {
    const vdf = await readFile(join(steamRoot, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    // Pull every "path" "..." entry; the VDF escapes backslashes as \\, so unescape them.
    const pathPattern = /"path"\s+"([^"]+)"/g;
    for (const match of vdf.matchAll(pathPattern)) {
      const libraryPath = match[1];
      if (libraryPath !== undefined) {
        paths.add(libraryPath.replace(/\\\\/g, '\\'));
      }
    }
  } catch {
    // No library file (or unreadable). The Steam root alone still covers default installs.
  }

  return [...paths];
}

function gsiConfigContents(gsiPort: number): string {
  // Valve KeyValues (VDF). Only the blocks the overlay actually reads are enabled (see
  // dotaGsiPayload.ts: map.game_state, the hero block, and the per-team player block); the rest are
  // listed but off so the payloads stay small. 127.0.0.1 (not localhost) to match the IPv4-only
  // listener and avoid an IPv6 (::1) resolution miss.
  return `"Observer Studio Integration"
{
    "uri"           "http://${NETWORK_HOST}:${gsiPort}/gsi"
    "timeout"       "5.0"
    "buffer"        "0.1"
    "throttle"      "0.1"
    "heartbeat"     "30.0"
    "data"
    {
        "provider"       "1"
        "map"            "1"
        "player"         "1"
        "hero"           "1"
        "abilities"      "0"
        "items"          "0"
        "events"         "0"
        "buildings"      "0"
        "league"         "0"
        "draft"          "0"
        "wearables"      "0"
        "minimap"        "0"
        "roshan"         "0"
        "couriers"       "0"
        "neutralitems"   "0"
    }
}
`;
}
