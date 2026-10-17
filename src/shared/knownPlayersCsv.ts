import { isValidAccountId } from './accountId.js';
import type { KnownPlayer } from './knownPlayer.js';

const HEADER = ['accountId', 'name', 'mmr', 'teamId'] as const;

export interface ParseResult {
  players: KnownPlayer[];

  skipped: number;
}

export function serializeKnownPlayersCsv(players: readonly KnownPlayer[]): string {
  const lines = [HEADER.join(',')];
  for (const player of players) {
    lines.push(
      [
        escapeField(player.accountId),
        escapeField(player.name),
        player.mmr === null ? '' : String(player.mmr),
        player.teamId === null ? '' : escapeField(player.teamId)
      ].join(',')
    );
  }
  return lines.join('\r\n');
}

export function parseKnownPlayersCsv(text: string): ParseResult {
  const rows = parseRows(text);

  if (rows[0]?.[0]?.trim().toLowerCase() === HEADER[0].toLowerCase()) {
    rows.shift();
  }

  const players: KnownPlayer[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const row of rows) {
    if (row.length === 1 && (row[0] ?? '').trim() === '') {
      continue;
    }

    const accountId = (row[0] ?? '').trim();
    const name = unguardFormulaField((row[1] ?? '').trim());

    if (!isValidAccountId(accountId) || name === '' || seen.has(accountId)) {
      skipped += 1;
      continue;
    }

    const teamId = (row[3] ?? '').trim();

    seen.add(accountId);
    players.push({
      accountId,
      name,
      mmr: parseMmr(row[2] ?? ''),
      teamId: teamId === '' ? null : teamId
    });
  }

  return { players, skipped };
}

export function parseMmr(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }

  const mmr = Math.round(Number(trimmed));
  return Number.isSafeInteger(mmr) && mmr >= 0 ? mmr : null;
}

const FORMULA_LEAD = /^[=+\-@]/u;

function escapeField(value: string): string {
  const guarded = FORMULA_LEAD.test(value) ? `'${value}` : value;

  if (/[",\r\n]/u.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

function unguardFormulaField(value: string): string {
  return value.startsWith("'") && FORMULA_LEAD.test(value.slice(1)) ? value.slice(1) : value;
}

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

  if (field !== '' || row.length > 0) {
    pushRow();
  }

  return rows;
}
