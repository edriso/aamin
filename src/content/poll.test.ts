import { describe, it, expect } from 'vitest';
import { buildParentingPoll } from './poll';

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
