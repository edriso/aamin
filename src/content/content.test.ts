import { describe, it, expect } from 'vitest';
import { morningReminders } from './morningReminders';
import { fridayFamily } from './fridayFamily';
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

  it('daily rotation never shows the same tip on consecutive days (over a full year)', () => {
    let day = new Date('2026-01-01T07:00:00Z');
    for (let i = 0; i < 366; i++) {
      const next = new Date(day.getTime() + 86_400_000);
      expect(pickForDay(morningReminders, day, 'Africa/Cairo')).not.toBe(
        pickForDay(morningReminders, next, 'Africa/Cairo'),
      );
      day = next;
    }
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

describe('welcomeMessage', () => {
  it('is non-blank and within the message limit', () => {
    expect(welcomeMessage.trim().length).toBeGreaterThan(0);
    expect(welcomeMessage.length).toBeLessThanOrEqual(MAX_MESSAGE);
  });
});
