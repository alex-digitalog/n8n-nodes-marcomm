/**
 * Turns what the n8n form holds into what the Marcomm API takes. Pure functions: the node glue in request.ts calls them.
 *
 *  - list fields arrive as one comma separated string and go out as a JSON array
 *  - approvers and recipients arrive as a fixed collection ({ approver: [...] } / { recipient: [...] }) and go out as an array
 *  - date fields go out as ISO 8601 in UTC. A date without an offset is read in the workflow time zone.
 */
export const LIST_FIELDS = ['seoKeywords', 'to', 'cc', 'groupIds', 'testTo', 'recipientIds'] as const;
export const DATE_FIELDS = ['scheduledAt', 'embargoLiftsAt', 'startAt', 'endAt', 'deadline', 'updated_since'] as const;

type Dict = Record<string, unknown>;

export function splitList(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Offset in ms of a time zone at an instant (local wall clock minus UTC). */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - Math.floor(utcMs / 1000) * 1000;
}

const NAIVE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;
const HAS_OFFSET = /T[^+-]*(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

/** ISO 8601 in UTC. Unreadable text is returned unchanged so the API can name the bad field. */
export function toIsoUtc(value: string, timeZone?: string): string {
  const v = value.trim();
  if (HAS_OFFSET.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  const m = NAIVE.exec(v);
  if (!m) return value;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  // ponytail: the offset is taken at the wall-clock instant read as UTC, so a time inside a daylight saving gap can be off by an hour.
  // Needed exactly? Give an offset in the date, or use a Luxon expression in the field.
  let offset = 0;
  try {
    offset = timeZone && timeZone !== 'UTC' ? zoneOffsetMs(wall, timeZone) : 0;
  } catch {
    offset = 0;
  }
  return new Date(wall - offset).toISOString();
}

const clean = (o: Dict): Dict => Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v !== 'string' || v.trim() !== ''));

function unwrapRows(value: unknown, key: string, fields: string[]): unknown {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return value;
  const rows = (value as Dict)[key];
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => clean(Object.fromEntries(fields.map((f) => [f, typeof (r as Dict)[f] === 'string' ? ((r as Dict)[f] as string).trim() : (r as Dict)[f]]))));
}

/** Rewrites one body or query object in place. */
export function normalizeParams(obj: Dict | undefined, timeZone?: string): void {
  if (!obj) return;
  for (const key of LIST_FIELDS) if (key in obj) obj[key] = splitList(obj[key]);
  for (const key of DATE_FIELDS) if (typeof obj[key] === 'string' && obj[key] !== '') obj[key] = toIsoUtc(obj[key] as string, timeZone);
  if ('approvers' in obj) {
    obj.approvers = unwrapRows(obj.approvers, 'approver', ['userId', 'role']);
    // No approver chosen: leave the field out so the workspace's own approval flow applies.
    if (Array.isArray(obj.approvers) && obj.approvers.length === 0) delete obj.approvers;
  }
  if ('recipients' in obj) obj.recipients = unwrapRows(obj.recipients, 'recipient', ['name', 'email', 'outletName', 'contactId']);
}
