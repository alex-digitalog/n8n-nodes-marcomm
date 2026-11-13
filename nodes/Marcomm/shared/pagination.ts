/** Largest page the Marcomm API serves for the polling lists (press releases, blog posts, press events). */
export const PAGE_SIZE = 50;
/** Stop after this many pages. A runaway cursor must not loop forever. */
export const MAX_PAGES = 100;

export interface Page<T> {
  rows: T[];
  /** `meta.next_cursor` of the response. Null or missing means the last page. */
  next: string | null;
}

/**
 * Follows `meta.next_cursor` until the list ends or `max` rows are collected.
 * `fetchPage` gets the cursor to continue from (undefined for the first page) and the page size to ask for.
 */
export async function collectPages<T>(
  fetchPage: (cursor: string | undefined, pageSize: number) => Promise<Page<T>>,
  opts: { max?: number; startCursor?: string } = {},
): Promise<T[]> {
  const out: T[] = [];
  let cursor = opts.startCursor || undefined;
  const seen = new Set<string>();
  for (let i = 0; i < MAX_PAGES; i++) {
    const want = opts.max === undefined ? PAGE_SIZE : Math.min(PAGE_SIZE, opts.max - out.length);
    if (want <= 0) break;
    const page = await fetchPage(cursor, want);
    out.push(...page.rows);
    if (!page.next || seen.has(page.next)) break;
    seen.add(page.next);
    cursor = page.next;
  }
  return opts.max === undefined ? out : out.slice(0, opts.max);
}
