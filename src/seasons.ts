/**
 * Islamic-calendar season detection for the seasonal content tracks
 * (Ramadan, the first ten of Dhul-Hijjah, and the two Eids).
 *
 * Why this lives in aamin and not the kit: the shared kernel owns generic
 * plumbing (dayNumberIn, pickForDay, post, ...). Hijri seasons are
 * content-shaped and aamin is the first bot to need them, so the logic
 * stays local for now. If a sibling bot ever needs it, promote it to the
 * kit and ship a tag (see the shared CLAUDE.md).
 *
 * How it works: we read the Umm al-Qura (umalqura) Hijri date straight
 * from `Intl`, the same convention the rest of the bot follows for all
 * day/time math (never the host clock). No library, restart-safe, pure.
 *
 * ⚠️ Known limitation (documented on purpose): Umm al-Qura is a CALCULATED
 * calendar. Local moon-sighting (e.g. Egypt's official sighting) can differ
 * from it by a day, so a season edge can land one day off the local ruling.
 * For a gentle content channel that is acceptable; the admin can preview
 * with `pnpm send-test` and, if a given year is off, nudge the post by hand
 * via `/admin_run <name> force`. The pure functions below take `now`/`tz`
 * so this is all unit-testable without waiting a year for Ramadan.
 */
import { config } from './config';

/** A Hijri calendar date. `month` is 1..12 (1 = Muharram, 9 = Ramadan,
 *  10 = Shawwal, 12 = Dhul-Hijjah); `day` is 1..30. */
export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

// Hijri month numbers we care about, named so the predicates read clearly.
const RAMADAN = 9;
const SHAWWAL = 10;
const DHUL_HIJJAH = 12;

/**
 * The Umm al-Qura Hijri date for `now` in `tz`. Pure: reads only `Intl`,
 * no clock or host calendar. Defaults bind it to config.timezone so callers
 * (skipIf, the content pickers) can call it with no arguments.
 */
export function hijriDate(now: Date = new Date(), tz: string = config.timezone): HijriDate {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const num = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: num('year'), month: num('month'), day: num('day') };
}

/** Ramadan (the whole month). Drives the daily pre-iftar track. */
export function isRamadan(now: Date = new Date(), tz: string = config.timezone): boolean {
  return hijriDate(now, tz).month === RAMADAN;
}

/**
 * The blessed first nine of Dhul-Hijjah (1..9, culminating on Arafah, the
 * 9th). The 10th is Eid al-Adha, owned by the Eid greeting below, so the
 * daily "best ten days" track stops at 9 and hands the 10th to the Eid post.
 */
export function isBlessedTenDhulHijjah(
  now: Date = new Date(),
  tz: string = config.timezone,
): boolean {
  const { month, day } = hijriDate(now, tz);
  return month === DHUL_HIJJAH && day >= 1 && day <= 9;
}

/** The day of Arafah (9 Dhul-Hijjah): the peak of the ten, and the fast
 *  that expiates two years for non-pilgrims. The Dhul-Hijjah picker shows
 *  Arafah-specific content on this day. */
export function isArafah(now: Date = new Date(), tz: string = config.timezone): boolean {
  const { month, day } = hijriDate(now, tz);
  return month === DHUL_HIJJAH && day === 9;
}

/** Eid al-Fitr (1 Shawwal). One warm greeting on the first morning. */
export function isEidAlFitr(now: Date = new Date(), tz: string = config.timezone): boolean {
  const { month, day } = hijriDate(now, tz);
  return month === SHAWWAL && day === 1;
}

/** Eid al-Adha (10 Dhul-Hijjah, Yawm al-Nahr). */
export function isEidAlAdha(now: Date = new Date(), tz: string = config.timezone): boolean {
  const { month, day } = hijriDate(now, tz);
  return month === DHUL_HIJJAH && day === 10;
}

/** Either Eid's first day. Drives the single celebratory Eid greeting. */
export function isEidDay(now: Date = new Date(), tz: string = config.timezone): boolean {
  return isEidAlFitr(now, tz) || isEidAlAdha(now, tz);
}
