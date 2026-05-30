import { describe, it, expect } from 'vitest';
import { buildParentingPoll } from './poll';

// Telegram poll limits we must never exceed.
const MAX_QUESTION = 300;
const MAX_OPTION = 100;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

// Fixed dates in Africa/Cairo (the test timezone): pick a known weekday.
// 2026-05-31 is a Sunday; 2026-06-05 is a Friday; 2026-06-06 is a Saturday.
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
      // Step day by day from Sunday so all weekday branches are covered.
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

  // The family-time option carries a unique tree emoji; match on that
  // rather than the word, since "للعائلة" (with the preposition) does not
  // contain the bare substring "العائلة".
  const FAMILY_MARK = '🌳';

  it('shows 9 base options on a weekday (no weekend extra)', () => {
    const spec = buildParentingPoll(SUNDAY, 'Africa/Cairo');
    expect(spec.options).toHaveLength(9);
    expect(spec.options.some((o) => o.includes(FAMILY_MARK))).toBe(false);
  });

  it('adds the family-time option on Friday and Saturday', () => {
    for (const weekend of [FRIDAY, SATURDAY]) {
      const spec = buildParentingPoll(weekend, 'Africa/Cairo');
      expect(spec.options).toHaveLength(10);
      const familyIdx = spec.options.findIndex((o) => o.includes(FAMILY_MARK));
      expect(familyIdx).toBeGreaterThan(-1);
      // Inserted right after the "encourage/teach" anchor, before the
      // bedtime option (which stays last).
      expect(spec.options[familyIdx - 1]).toContain('علّمتُهم');
      expect(spec.options[spec.options.length - 1]).toContain('نوّمتُهم');
    }
  });

  it('always keeps the affection option first and bedtime option last', () => {
    const spec = buildParentingPoll(FRIDAY, 'Africa/Cairo');
    expect(spec.options[0]).toContain('عانقتُ');
    expect(spec.options[spec.options.length - 1]).toContain('نوّمتُهم');
  });
});
