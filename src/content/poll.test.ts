import { describe, it, expect } from 'vitest';
import { buildParentingPoll } from './poll';

// Telegram poll limits we must never exceed.
const MAX_QUESTION = 300;
const MAX_OPTION = 100;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

describe('buildParentingPoll', () => {
  it('is anonymous, multi-answer, and auto-closes within the day', () => {
    const spec = buildParentingPoll();
    expect(spec.isAnonymous).toBe(true);
    expect(spec.allowsMultipleAnswers).toBe(true);
    expect(spec.closeAfterHours).toBe(22);
  });

  it("has exactly 10 options (Telegram's maximum)", () => {
    expect(buildParentingPoll().options).toHaveLength(10);
  });

  it('respects Telegram limits', () => {
    const spec = buildParentingPoll();
    expect(spec.question.length).toBeLessThanOrEqual(MAX_QUESTION);
    expect(spec.options.length).toBeGreaterThanOrEqual(MIN_OPTIONS);
    expect(spec.options.length).toBeLessThanOrEqual(MAX_OPTIONS);
    for (const opt of spec.options) {
      expect(opt.length).toBeGreaterThan(0);
      // Leave headroom for rtlIsolate (+2 chars) added in lib/post.ts.
      expect(opt.length).toBeLessThanOrEqual(MAX_OPTION - 2);
    }
  });

  it('has no duplicate options', () => {
    const opts = buildParentingPoll().options;
    expect(new Set(opts).size).toBe(opts.length);
  });

  it('keeps the affection option first and the bedtime option last', () => {
    const opts = buildParentingPoll().options;
    expect(opts[0]).toContain('عانقتُ');
    expect(opts[opts.length - 1]).toContain('نوّمتُهم');
  });

  it('includes a screen-time option (📵)', () => {
    expect(buildParentingPoll().options.some((o) => o.includes('الشاشات'))).toBe(true);
  });

  it('the anger option also covers not insulting the child', () => {
    const angerOpt = buildParentingPoll().options.find((o) => o.includes('غضبي'));
    expect(angerOpt).toBeDefined();
    expect(angerOpt).toContain('أُهِنهم');
  });
});
