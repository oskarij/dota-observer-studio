import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

import { logWarning } from '../shared/logger.js';
import { NETWORK_HOST } from '../shared/networkConfig.js';

const execFileAsync = promisify(execFile);

export const CONFIG_FILE_NAME = 'gamestate_integration_observer_studio.cfg';

// Relative to a Steam library root.
const DOTA_CFG_RELATIVE = join('steamapps', 'common', 'dota 2 beta', 'game', 'dota', 'cfg');

// Searches every Steam library; null when Dota is in none of them.
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

// Writes to `<cfgDir>/gamestate_integration/`, or to cfgDir when the user picked that folder.
export async function writeGsiConfig(
  cfgDir: string,
  gsiPort: number,
  token: string
): Promise<string> {
  const targetDir =
    basename(cfgDir).toLowerCase() === 'gamestate_integration'
      ? cfgDir
      : join(cfgDir, 'gamestate_integration');
  await mkdir(targetDir, { recursive: true });

  const filePath = join(targetDir, CONFIG_FILE_NAME);
  await writeFile(filePath, buildGsiConfig(NETWORK_HOST, gsiPort, token), 'utf8');
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
    // Startup waits on this (the Dota font copy), so a stuck query must not hold the app.
    const { stdout } = await execFileAsync(
      'reg',
      ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      { timeout: 5_000, windowsHide: true }
    );

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

// Library roots from libraryfolders.vdf, plus the Steam root.
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

// host is the address Dota POSTs to: loopback for a local install, or the app's LAN IP for an
// exported config used by Dota on another PC.
export function buildGsiConfig(host: string, gsiPort: number, token: string): string {
  // Only the blocks dotaGsiPayload.ts reads are on. throttle 0.2 caps Dota at five updates per
  // second; draft countdowns tick locally. The host is an IPv4 literal because localhost can
  // resolve to ::1, which the IPv4 listener does not accept. Dota sends the auth token with
  // every update.
  return `"Observer Studio Integration"
{
    "uri"           "http://${host}:${gsiPort}/gsi"
    "timeout"       "5.0"
    "buffer"        "0.1"
    "throttle"      "0.2"
    "heartbeat"     "30.0"
    "auth"
    {
        "token"          "${token}"
    }
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
        "league"         "1"
        "draft"          "1"
        "wearables"      "0"
        "minimap"        "0"
        "roshan"         "0"
        "couriers"       "0"
        "neutralitems"   "0"
    }
}
`;
}
