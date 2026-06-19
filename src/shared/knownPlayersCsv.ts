import type { KnownPlayer } from './knownPlayer.js';

// CSV backup format for the known-players list. Pure string code (no DOM/Node APIs) so the renderer
// and unit tests can both use it. Validation mirrors the inline editor in known-players.svelte:
// numeric account ids, a required name, and an optional integer MMR.

const HEADER = ['accountId', 'name', 'mmr'] as const;

export interface ParseResult {
  players: KnownPlayer[];
  // Rows dropped for being invalid (bad account id, blank name) or duplicate, so the UI can report it.
  skipped: number;
}

export function serializeKnownPlayersCsv(players: readonly KnownPlayer[]): string {
  const lines = [HEADER.join(',')];
  for (const player of players) {
    lines.push(
      [
        escapeField(player.accountId),
        escapeField(player.name),
        player.mmr === null ? '' : String(player.mmr)
      ].join(',')
    );
  }
  return lines.join('\r\n');
}

export function parseKnownPlayersCsv(text: string): ParseResult {
  const rows = parseRows(text);

  // Drop a leading header row (matched case-insensitively on the first cell).
  if (rows[0]?.[0]?.trim().toLowerCase() === HEADER[0].toLowerCase()) {
    rows.shift();
  }

  const players: KnownPlayer[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const row of rows) {
    // Skip fully blank lines without counting them as errors.
    if (row.length === 1 && (row[0] ?? '').trim() === '') {
      continue;
    }

    const accountId = (row[0] ?? '').trim();
    const name = (row[1] ?? '').trim();

    if (!isValidAccountId(accountId) || name === '' || seen.has(accountId)) {
      skipped += 1;
      continue;
    }

    seen.add(accountId);
    players.push({ accountId, name, mmr: parseMmr(row[2] ?? '') });
  }

  return { players, skipped };
}

function isValidAccountId(accountId: string): boolean {
  return /^[0-9]+$/u.test(accountId);
}

function parseMmr(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }

  const mmr = Number(trimmed);
  return Number.isFinite(mmr) ? Math.round(mmr) : null;
}

function escapeField(value: string): string {
  // Quote per RFC 4180 when the field contains a comma, quote, or newline.
  if (/[",\r\n]/u.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Minimal RFC 4180 reader: handles quoted fields, escaped quotes ("") and quoted newlines.
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = (): void => {
    row.push(field);
    field = '';
  };
  const pushRow = (): void => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    // charAt (not text[i]) returns string, never string | undefined, so concatenation is clean.
    const char = text.charAt(i);

    if (inQuotes) {
      if (char === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRow();
    } else if (char !== '\r') {
      field += char;
    }
  }

  // Flush the trailing row unless the input ended exactly on a newline.
  if (field !== '' || row.length > 0) {
    pushRow();
  }

  return rows;
}
