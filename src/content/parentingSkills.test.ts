import { describe, it, expect } from 'vitest';
import { parentingSkills, pickParentingSkill } from './parentingSkills';

const MAX_MESSAGE = 4096; // Telegram single-message hard limit.
const TZ = 'Africa/Cairo';
// Noon UTC stays the same calendar day in Cairo, so day(i) is a clean run
// of consecutive days.
const day = (i: number) => new Date(Date.UTC(2026, 0, 1, 12, 0, 0) + i * 86_400_000);

describe('parentingSkills', () => {
  it('has a healthy pool (a daily message needs room for ~a month without repeats)', () => {
    // The track fires DAILY, so the pool must be large enough that a skill
    // does not come back for weeks (a daily message that repeats fast loses
    // its weight). Keep it well above the morning floor.
    expect(parentingSkills.length).toBeGreaterThanOrEqual(24);
  });

  it('every skill is non-blank and within a readable length', () => {
    for (const skill of parentingSkills) {
      expect(skill.trim().length).toBeGreaterThan(0);
      expect(skill.length).toBeLessThanOrEqual(MAX_MESSAGE);
      // Keep them short and skimmable, not walls of text.
      expect(skill.length).toBeLessThanOrEqual(900);
    }
  });

  it('has no duplicate skills', () => {
    expect(new Set(parentingSkills).size).toBe(parentingSkills.length);
  });

  it('opens each skill with a distinct, on-tone leading emoji', () => {
    // CLAUDE.md: one leading emoji per item, distinct within the pool, and
    // no off-tone signs (rainbow, or a church/vigil candle / Diwali lamp).
    const leads = parentingSkills.map((s) => Array.from(s.trim())[0]);
    expect(new Set(leads).size).toBe(leads.length);
    for (const skill of parentingSkills) {
      expect(skill).not.toContain('🌈');
      expect(skill).not.toContain('🕯️');
      expect(skill).not.toContain('🪔');
    }
  });

  it('uses no em dash (the channel style forbids it)', () => {
    for (const skill of parentingSkills) {
      expect(skill).not.toContain('—');
    }
  });

  // The track teaches the parent's own skills (calm under pressure, handling
  // mistakes, clear instructions). Guard that the self-regulation strand
  // (the heart of the "trained teacher" idea) stays present.
  it('keeps a parent self-regulation strand', () => {
    const markers = ['اهدأ أنتَ أوّلًا', 'هدوؤك يُعديه', 'ستهدأ الموجة', 'افحَص نفسك'];
    const found = parentingSkills.filter((s) => markers.some((m) => s.includes(m)));
    expect(found.length).toBeGreaterThanOrEqual(3);
  });

  // The only verbatim Quran in this pool is Luqman 19. Pin its exact wording
  // (verified against quran.com) so a future edit cannot corrupt it, and pin
  // that it sits inside the Quran guillemets ﴿...﴾.
  it('quotes Luqman 31:19 exactly (واغضض من صوتك)', () => {
    // Exactly one skill carries the verbatim ayah, inside the Quran
    // guillemets ﴿...﴾ (verified against quran.com).
    const withAyah = parentingSkills.filter((s) => s.includes('﴿وَاغْضُضْ مِن صَوْتِكَ﴾'));
    expect(withAyah.length).toBe(1);
  });

  // The rotation is pickParentingSkill (epoch-day count + a fixed
  // deterministic shuffle, via the shared rotation helper), so it has the
  // same guarantees as the morning tip: even spacing, full coverage, no
  // consecutive repeat, and year-boundary safety.
  it('never shows the same skill on consecutive days (across a year, incl. New Year)', () => {
    for (let i = -10; i < 400; i++) {
      expect(pickParentingSkill(day(i), TZ)).not.toBe(pickParentingSkill(day(i + 1), TZ));
    }
  });

  it('shows every skill exactly once in any window of pool-length days', () => {
    const n = parentingSkills.length;
    for (const start of [-5, 0, 13, 360]) {
      const seen = new Set<string>();
      for (let i = 0; i < n; i++) seen.add(pickParentingSkill(day(start + i), TZ) as string);
      expect(seen.size).toBe(n);
    }
  });

  it('keeps repeats a full pool apart (never the "a couple of days" bug)', () => {
    const n = parentingSkills.length;
    const lastSeen = new Map<string, number>();
    let minGap = Infinity;
    for (let i = 0; i < n * 3; i++) {
      const skill = pickParentingSkill(day(i), TZ) as string;
      if (lastSeen.has(skill)) minGap = Math.min(minGap, i - (lastSeen.get(skill) as number));
      lastSeen.set(skill, i);
    }
    expect(minGap).toBe(n);
  });

  it('is deterministic and timezone-pure (same day+tz => same skill)', () => {
    const noon = new Date('2026-06-07T10:00:00Z'); // 12:00 Cairo
    const afternoon = new Date('2026-06-07T13:00:00Z'); // 15:00 Cairo, same day
    expect(pickParentingSkill(noon, TZ)).toBe(pickParentingSkill(afternoon, TZ));
  });
});
