/**
 * Pick a string to post: a fixed string as-is, or one entry from an
 * array. Blank entries are skipped; both pickers return null when nothing
 * postable remains, so the caller skips the tick instead of sending an
 * empty message Telegram would reject anyway.
 */

/** Random pick from an array (or a fixed string returned as-is). */
export function pickContent(content: string | readonly string[]): string | null {
  if (typeof content === 'string') return content.trim() ? content : null;
  const usable = content.filter((c) => c.trim().length > 0);
  if (usable.length === 0) return null;
  return usable[Math.floor(Math.random() * usable.length)];
}

/**
 * Day-of-year (1..366) for a Date in a given IANA timezone, computed by
 * formatting the date in that timezone (so "today" means today in
 * TZ_NAME, not on the host clock). Pure: no global Date mutation.
 */
export function dayOfYearIn(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const startOfYear = Date.UTC(year, 0, 1);
  const thisDay = Date.UTC(year, month - 1, day);
  return Math.round((thisDay - startOfYear) / 86_400_000) + 1;
}

/**
 * Deterministic daily pick: rotates through the array by day-of-year, so
 * the same calendar day always shows the same entry, two consecutive days
 * never repeat (consecutive day numbers differ by one, and the pool has
 * more than one usable entry), and the whole pool is covered before any
 * repeat. No state needed, so it is restart-safe by construction. A fixed
 * string is returned as-is.
 *
 * Used by the morning reminder so a follower never sees yesterday's tip
 * again today.
 */
export function pickForDay(
  content: string | readonly string[],
  now: Date,
  timezone: string,
): string | null {
  if (typeof content === 'string') return content.trim() ? content : null;
  const usable = content.filter((c) => c.trim().length > 0);
  if (usable.length === 0) return null;
  const index = (dayOfYearIn(now, timezone) - 1) % usable.length;
  return usable[index];
}
