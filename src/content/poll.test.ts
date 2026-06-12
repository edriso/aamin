import { describe, it, expect } from 'vitest';
import { dayNumberIn } from 'telegram-broadcast-kit';
import { buildParentingPoll, pollFiresTonight } from './poll';

// Telegram poll limits (Bot API 9.1+, July 2025: max raised 10 -> 12).
const MAX_QUESTION = 300;
const MAX_OPTION = 100;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 12;

// Fixed dates in Africa/Cairo (the test timezone): a known weekday and
// the two weekend days. 2026-05-31 is Sunday; 2026-06-05 Friday; 06-06 Saturday.
const SUNDAY = new Date('2026-05-31T18:00:00Z');
const FRIDAY = new Date('2026-06-05T18:00:00Z');
const SATURDAY = new Date('2026-06-06T18:00:00Z');

describe('buildParentingPoll', () => {
  it('is anonymous, multi-answer, and auto-closes within the day', () => {
    const spec = buildParentingPoll(SUNDAY, 'Africa/Cairo');
    expect(spec.isAnonymous).toBe(true);
    expect(spec.allowsMultipleAnswers).toBe(true);
    expect(spec.closeAfterHours).toBe(22);
  });

  it('respects Telegram limits every day of the week', () => {
    for (let d = 0; d < 7; d++) {
      const day = new Date(SUNDAY.getTime() + d * 86_400_000);
      const spec = buildParentingPoll(day, 'Africa/Cairo');
      expect(spec.question.length).toBeLessThanOrEqual(MAX_QUESTION);
      expect(spec.options.length).toBeGreaterThanOrEqual(MIN_OPTIONS);
      expect(spec.options.length).toBeLessThanOrEqual(MAX_OPTIONS);
      for (const opt of spec.options) {
        expect(opt.length).toBeGreaterThan(0);
        // Leave headroom for rtlIsolate (+2 chars) added in lib/post.ts.
        expect(opt.length).toBeLessThanOrEqual(MAX_OPTION - 2);
      }
    }
  });

  it('has no duplicate options on any day', () => {
    for (let d = 0; d < 7; d++) {
      const day = new Date(SUNDAY.getTime() + d * 86_400_000);
      const spec = buildParentingPoll(day, 'Africa/Cairo');
      expect(new Set(spec.options).size).toBe(spec.options.length);
    }
  });

  it('shows 10 base options on a weekday (no weekend extra)', () => {
    const spec = buildParentingPoll(SUNDAY, 'Africa/Cairo');
    expect(spec.options).toHaveLength(10);
    expect(spec.options.some((o) => o.includes('🌳'))).toBe(false);
  });

  it('adds the family-time option on Friday and Saturday (11 options)', () => {
    for (const weekend of [FRIDAY, SATURDAY]) {
      const spec = buildParentingPoll(weekend, 'Africa/Cairo');
      expect(spec.options).toHaveLength(11);
      const familyIdx = spec.options.findIndex((o) => o.includes('🌳'));
      expect(familyIdx).toBeGreaterThan(-1);
      // Inserted right after the screen-time option, before bedtime (last).
      expect(spec.options[familyIdx - 1]).toContain('الشاشات');
      expect(spec.options[spec.options.length - 1]).toContain('نوّمتُهم');
    }
  });

  // Pins the weekend rule across the WHOLE week, so nobody has to wonder
  // "why did the family option show up on Saturday?" again. The family
  // option (🌳) is a WEEKEND option: it appears on exactly Friday AND
  // Saturday (the weekend in most Arab countries) and on no other day.
  // This is separate from the `friday_family` weekly message, which posts
  // on Friday only. Saturday showing the family option is intended.
  it('shows the family option on exactly Friday and Saturday, no other day', () => {
    const expected: Record<number, boolean> = {
      0: false, // Sunday
      1: false, // Monday
      2: false, // Tuesday
      3: false, // Wednesday
      4: false, // Thursday
      5: true, //  Friday
      6: true, //  Saturday
    };
    for (let d = 0; d < 7; d++) {
      const day = new Date(SUNDAY.getTime() + d * 86_400_000);
      const spec = buildParentingPoll(day, 'Africa/Cairo');
      const hasFamily = spec.options.some((o) => o.includes('🌳'));
      const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        weekday: 'short',
      }).format(day);
      expect(hasFamily, `family option on ${weekday} should be ${expected[d]}`).toBe(expected[d]);
      expect(spec.options).toHaveLength(expected[d] ? 11 : 10);
    }
  });

  it('keeps the affection option first and the bedtime option last', () => {
    const spec = buildParentingPoll(FRIDAY, 'Africa/Cairo');
    expect(spec.options[0]).toContain('عانقتُ');
    expect(spec.options[spec.options.length - 1]).toContain('نوّمتُهم');
  });

  it('includes a screen-time option (📵) every day', () => {
    for (const day of [SUNDAY, FRIDAY]) {
      expect(
        buildParentingPoll(day, 'Africa/Cairo').options.some((o) => o.includes('الشاشات')),
      ).toBe(true);
    }
  });

  it('the anger option also covers not insulting the child', () => {
    const angerOpt = buildParentingPoll(SUNDAY, 'Africa/Cairo').options.find((o) =>
      o.includes('غضبي'),
    );
    expect(angerOpt).toBeDefined();
    expect(angerOpt).toContain('أُهِنهم');
  });
});

describe('pollFiresTonight (every-other-night cadence)', () => {
  const TZ = 'Africa/Cairo';

  it('fires on the even epoch-nights and skips the odd ones', () => {
    // Walk a run of consecutive days and assert the fire flag tracks the
    // parity of the epoch-day count exactly.
    for (let d = 0; d < 14; d++) {
      const day = new Date(SUNDAY.getTime() + d * 86_400_000);
      const expected = dayNumberIn(day, TZ) % 2 === 0;
      expect(pollFiresTonight(day, TZ)).toBe(expected);
    }
  });

  it('alternates every single night (never two fires or two skips in a row)', () => {
    let prev = pollFiresTonight(SUNDAY, TZ);
    for (let d = 1; d < 30; d++) {
      const day = new Date(SUNDAY.getTime() + d * 86_400_000);
      const now = pollFiresTonight(day, TZ);
      expect(now, `night ${d} should differ from night ${d - 1}`).not.toBe(prev);
      prev = now;
    }
  });

  it('fires on exactly half the nights over a fortnight', () => {
    let fires = 0;
    for (let d = 0; d < 14; d++) {
      const day = new Date(SUNDAY.getTime() + d * 86_400_000);
      if (pollFiresTonight(day, TZ)) fires++;
    }
    expect(fires).toBe(7);
  });
});
