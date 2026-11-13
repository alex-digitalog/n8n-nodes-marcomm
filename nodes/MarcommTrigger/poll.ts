/**
 * Polling logic of the Marcomm AI Trigger, free of n8n so it can be tested alone.
 *
 * What is stored between polls (workflow static data, per event): `since`, the newest `updatedAt` seen, and `known`,
 * the last status seen per id. The list endpoints answer newest first and filter with `updated_since` (strictly later),
 * so a poll asks for rows changed after `since`, pages to the end, emits the rows that match the event and moves `since`
 * to the newest `updatedAt`. The first poll only sets the baseline and emits nothing.
 */
export interface Row {
  id: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
  [key: string]: unknown;
}

export type Resource = 'press-releases' | 'blog-posts' | 'press-events';

export interface TriggerEvent {
  /** Value of the "Event" option of the node. */
  value: string;
  name: string;
  description: string;
  resource: Resource;
  /** Server side status filter on every poll, when only rows with that status can fire the event. */
  filterStatus?: string;
  /** Rows in this status at the first poll are remembered, so an item that already waits does not fire later. */
  baselineStatus?: string;
  /** Decides which of the changed rows fire the event. `prevSince` is the `since` before this poll. */
  matches: (row: Row, prevSince: string, known: Record<string, string>) => boolean;
}

const later = (a: string | null | undefined, b: string): boolean => !!a && new Date(a).getTime() > new Date(b).getTime();

const created = (row: Row, prevSince: string, known: Record<string, string>) => !(row.id in known) && later(row.createdAt, prevSince);
// publishedAt is stamped when the item goes public, so an old published item that is only edited does not fire again.
const published = (row: Row, prevSince: string, known: Record<string, string>) => row.status === 'PUBLISHED' && known[row.id] !== 'PUBLISHED' && later(row.publishedAt, prevSince);
const approvalRequested = (row: Row, _prev: string, known: Record<string, string>) => row.status === 'IN_REVIEW' && known[row.id] !== 'IN_REVIEW';

export const EVENTS: readonly TriggerEvent[] = [
  { value: 'pressReleaseCreated', name: 'Press Release Created', description: 'A press release draft was created', resource: 'press-releases', matches: created },
  { value: 'pressReleaseApprovalRequested', name: 'Press Release Approval Requested', description: 'A press release was sent to its approvers', resource: 'press-releases', baselineStatus: 'IN_REVIEW', matches: approvalRequested },
  { value: 'pressReleasePublished', name: 'Press Release Published', description: 'A press release went public', resource: 'press-releases', filterStatus: 'PUBLISHED', matches: published },
  { value: 'blogPostCreated', name: 'Blog Post Created', description: 'A blog post draft was created', resource: 'blog-posts', matches: created },
  { value: 'blogPostPublished', name: 'Blog Post Published', description: 'A blog post went public', resource: 'blog-posts', filterStatus: 'PUBLISHED', matches: published },
  { value: 'pressEventCreated', name: 'Press Event Created', description: 'A press event was created', resource: 'press-events', matches: created },
];

export const eventByValue = (value: string): TriggerEvent | undefined => EVENTS.find((e) => e.value === value);

export interface PollState {
  since: string;
  known: Record<string, string>;
}

/** Remembered ids per event. Oldest entries go first. */
export const KNOWN_MAX = 500;
/** Pages per poll (50 rows each). More changes than this between two polls need a shorter interval. */
export const POLL_MAX_PAGES = 40;
/** Used as the baseline when the workspace has no rows at all. */
export const EPOCH = '1970-01-01T00:00:00.000Z';

export interface PollResult {
  emit: Row[];
  state: PollState;
}

/** First poll: the newest changed row sets the baseline. Rows already in the watched status are remembered so they do not fire later. */
export function baseline(event: TriggerEvent, newest: Row | undefined, watched: Row[]): PollState {
  const status = event.baselineStatus;
  return { since: newest?.updatedAt ?? EPOCH, known: status ? Object.fromEntries(watched.slice(0, KNOWN_MAX).map((r) => [r.id, status])) : {} };
}

/** Later polls. `rows` are all rows changed after `state.since`, newest first. */
export function processRows(event: TriggerEvent, state: PollState, rows: Row[]): PollResult {
  const emit: Row[] = [];
  const known = { ...state.known };
  for (const row of rows) {
    if (event.matches(row, state.since, known)) emit.push(row);
    if (row.status) {
      delete known[row.id]; // re-insert so the newest rows sit last
      known[row.id] = row.status;
    }
  }
  const keys = Object.keys(known);
  for (const k of keys.slice(0, Math.max(0, keys.length - KNOWN_MAX))) delete known[k];
  const newest = rows[0]?.updatedAt;
  // Oldest first reads naturally in a workflow.
  return { emit: emit.reverse(), state: { since: newest && later(newest, state.since) ? newest : state.since, known } };
}
