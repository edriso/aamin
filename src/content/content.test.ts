import { describe, it, expect } from 'vitest';
import { morningReminders, pickMorningReminder } from './morningReminders';
import { fridayFamily } from './fridayFamily';
import { bedtimeRitual, bedtimeRituals, pickBedtimeContent } from './bedtime';
import { welcomeMessage } from './welcome';
import { pickForDay } from 'telegram-broadcast-kit';

// Telegram single-message hard limit. Our messages are far shorter, but
// guard against a future edit that accidentally pastes a huge block.
const MAX_MESSAGE = 4096;

describe('morningReminders', () => {
  it('has a healthy pool of tips (room for ~a month without repeats)', () => {
    expect(morningReminders.length).toBeGreaterThanOrEqual(28);
  });

  it('every tip is non-blank and within the Telegram message limit', () => {
    for (const tip of morningReminders) {
      expect(tip.trim().length).toBeGreaterThan(0);
      expect(tip.length).toBeLessThanOrEqual(MAX_MESSAGE);
      // Keep them short and morning-friendly, not walls of text.
      expect(tip.length).toBeLessThanOrEqual(900);
    }
  });

  it('has no duplicate tips', () => {
    expect(new Set(morningReminders).size).toBe(morningReminders.length);
  });

  // The pool has two voices (see morningReminders.ts header): tips aimed at
  // the child (what to DO with them) and a "sakina" strand aimed at the
  // parent's own heart (a calm parent is the child's first safety). This
  // guards the sakina strand so a future edit cannot quietly drop it.
  it('includes a parent-focused inner-peace (sakina) strand', () => {
    // Signature phrases from the parent-heart tips. A tip counts if it
    // speaks to the parent's own state, not only the child's.
    const sakinaMarkers = [
      'سلِّمهم لله',
      'بنفسك',
      'من الراحة',
      'شرحَ صدرك',
      'تعبُك',
      'الصبرُ ضياء',
      'قلبًا ليّنًا',
      'غضبُك',
    ];
    const sakinaTips = morningReminders.filter((tip) =>
      sakinaMarkers.some((marker) => tip.includes(marker)),
    );
    expect(sakinaTips.length).toBeGreaterThanOrEqual(6);
  });

  // The morning pick is pickMorningReminder (a fixed deterministic shuffle
  // keyed by the epoch-day count), NOT the kit's pickForDay. These tests pin
  // the properties that fix the "same tip two days apart" bug: even spacing,
  // full coverage, no consecutive repeat, year-boundary safety, and the
  // edit-gentleness that plain (day-of-year) % n lacked.
  const TZ = 'Africa/Cairo';
  // Noon UTC stays the same calendar day in Cairo, so day(i) is a clean run
  // of consecutive days.
  const day = (i: number) => new Date(Date.UTC(2026, 0, 1, 12, 0, 0) + i * 86_400_000);

  it('never shows the same tip on consecutive days (across a year, including New Year)', () => {
    // Start before 2026 so the Dec 31 -> Jan 1 boundary is covered: the old
    // day-of-year rotation could stutter there; the epoch-day count cannot.
    for (let i = -10; i < 400; i++) {
      expect(pickMorningReminder(day(i), TZ)).not.toBe(pickMorningReminder(day(i + 1), TZ));
    }
  });

  it('shows every tip exactly once in any window of pool-length days', () => {
    const n = morningReminders.length;
    // Try a few different starting offsets, including across the year edge.
    for (const start of [-5, 0, 17, 360]) {
      const seen = new Set<string>();
      for (let i = 0; i < n; i++) seen.add(pickMorningReminder(day(start + i), TZ) as string);
      expect(seen.size).toBe(n); // a full, repeat-free pass over the whole pool
    }
  });

  it('keeps repeats a full pool apart (never the "a couple of days" bug)', () => {
    const n = morningReminders.length;
    const lastSeen = new Map<string, number>();
    let minGap = Infinity;
    for (let i = 0; i < n * 3; i++) {
      const tip = pickMorningReminder(day(i), TZ) as string;
      if (lastSeen.has(tip)) minGap = Math.min(minGap, i - (lastSeen.get(tip) as number));
      lastSeen.set(tip, i);
    }
    // Every tip recurs on an exact pool-length cycle, so the closest any two
    // identical picks ever fall is n days apart.
    expect(minGap).toBe(n);
  });

  it('is deterministic and timezone-pure (same day+tz => same tip)', () => {
    // Different Date instants that are the same calendar day in Cairo must
    // resolve to the same tip (the pick keys on the day, not the clock time).
    const morning = new Date('2026-06-07T05:00:00Z'); // 07:00 Cairo
    const evening = new Date('2026-06-07T19:00:00Z'); // 21:00 Cairo, same day
    expect(pickMorningReminder(morning, TZ)).toBe(pickMorningReminder(evening, TZ));
  });
});

describe('fridayFamily (rotating weekly activity pool)', () => {
  it('every activity is non-blank and within the message limit', () => {
    expect(fridayFamily.length).toBeGreaterThan(0);
    for (const activity of fridayFamily) {
      expect(activity.trim().length).toBeGreaterThan(0);
      expect(activity.length).toBeLessThanOrEqual(MAX_MESSAGE);
    }
  });

  it('has no duplicate activities', () => {
    expect(new Set(fridayFamily).size).toBe(fridayFamily.length);
  });

  // CRITICAL invariant. Friday fires weekly (every 7 days), and pickForDay
  // rotates by (day-of-year) % (pool length). If the length were a multiple
  // of 7, the weekly step would land on the SAME activity every Friday, so
  // the pool would never rotate. Keep the count off any multiple of 7.
  it('pool size is not a multiple of 7, so it rotates every Friday', () => {
    expect(fridayFamily.length % 7).not.toBe(0);
  });

  // Belt-and-braces: actually walk a year of Fridays and confirm the pool
  // rotates (more than one distinct activity is shown over the year).
  it('shows more than one distinct activity across a year of Fridays', () => {
    const seen = new Set<string>();
    // 2026-01-02 is a Friday in Africa/Cairo; step 7 days, 53 times.
    let friday = new Date('2026-01-02T09:00:00+02:00');
    for (let w = 0; w < 53; w++) {
      const pick = pickForDay(fridayFamily, friday, 'Africa/Cairo');
      if (pick) seen.add(pick);
      friday = new Date(friday.getTime() + 7 * 86_400_000);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('bedtime ritual (alternates a fixed card with a rotating pool)', () => {
  const TZ = 'Africa/Cairo';
  // A run of consecutive calendar days (noon UTC stays the same day in Cairo).
  const day = (i: number) => new Date(Date.UTC(2026, 0, 1, 12, 0, 0) + i * 86_400_000);

  it('the fixed card is non-blank and within the message limit', () => {
    expect(bedtimeRitual.trim().length).toBeGreaterThan(0);
    expect(bedtimeRitual.length).toBeLessThanOrEqual(MAX_MESSAGE);
  });

  it('every rotating pool item is non-blank and within the message limit', () => {
    // Both the card and the pool are live (they alternate). The pool needs
    // at least 2 items to be a meaningful rotation.
    expect(bedtimeRituals.length).toBeGreaterThanOrEqual(2);
    for (const ritual of bedtimeRituals) {
      expect(ritual.trim().length).toBeGreaterThan(0);
      expect(ritual.length).toBeLessThanOrEqual(MAX_MESSAGE);
    }
  });

  it('has no duplicate pool items', () => {
    expect(new Set(bedtimeRituals).size).toBe(bedtimeRituals.length);
  });

  // The alternation contract: each night is EITHER the fixed card OR a pool
  // item (never both, never neither), and the kind flips every single day.
  it('alternates the fixed card and a pool item, flipping every day', () => {
    let prevWasCard: boolean | null = null;
    for (let i = 0; i < 14; i++) {
      const text = pickBedtimeContent(day(i), TZ);
      const isCard = text === bedtimeRitual;
      const inPool = bedtimeRituals.includes(text);
      expect(isCard !== inPool).toBe(true); // exactly one is true
      if (prevWasCard !== null) expect(isCard).toBe(!prevWasCard);
      prevWasCard = isCard;
    }
  });

  // Epoch-day parity (not day-of-year) so the flip never stutters at the
  // year boundary; and the pool steps by one each pool-night, so the whole
  // pool is covered regardless of its size.
  it('covers every pool item across enough pool-nights', () => {
    const seen = new Set<string>();
    for (let i = 0; i < bedtimeRituals.length * 4; i++) {
      const text = pickBedtimeContent(day(i), TZ);
      if (text !== bedtimeRitual) seen.add(text);
    }
    expect(seen.size).toBe(bedtimeRituals.length);
  });
});

describe('welcomeMessage', () => {
  it('is non-blank and within the message limit', () => {
    expect(welcomeMessage.trim().length).toBeGreaterThan(0);
    expect(welcomeMessage.length).toBeLessThanOrEqual(MAX_MESSAGE);
  });
});
