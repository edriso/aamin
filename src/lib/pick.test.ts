import { describe, it, expect } from 'vitest';
import { pickContent, pickForDay, dayOfYearIn } from './pick';

describe('pickContent', () => {
  it('returns the string as-is when input is a non-empty string', () => {
    expect(pickContent('hello')).toBe('hello');
  });

  it('returns null for an empty string (whitespace-only counts as empty)', () => {
    expect(pickContent('')).toBe(null);
    expect(pickContent('   ')).toBe(null);
  });

  it('returns null for an empty array', () => {
    expect(pickContent([])).toBe(null);
  });

  it('returns null for an array of only blank strings', () => {
    expect(pickContent(['', '   ', '\n\t'])).toBe(null);
  });

  it('never picks a blank entry from a mixed array', () => {
    const arr = ['', '  ', 'real'];
    for (let i = 0; i < 100; i++) {
      expect(pickContent(arr)).toBe('real');
    }
  });

  it('returns the single element when the array has one item', () => {
    expect(pickContent(['only'])).toBe('only');
  });

  it('returns an element that exists in the array', () => {
    const arr = ['a', 'b', 'c'];
    const result = pickContent(arr);
    expect(arr).toContain(result);
  });

  it('eventually picks each element from a multi-item array (probabilistic sanity check)', () => {
    const arr = ['a', 'b', 'c'];
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const picked = pickContent(arr);
      if (picked) seen.add(picked);
    }
    expect(seen.size).toBe(3);
  });

  it('accepts readonly arrays', () => {
    const arr = ['a', 'b'] as const;
    expect(['a', 'b']).toContain(pickContent(arr));
  });
});

describe('dayOfYearIn', () => {
  it('returns 1 for Jan 1', () => {
    expect(dayOfYearIn(new Date('2026-01-01T12:00:00Z'), 'UTC')).toBe(1);
  });

  it('returns 60 for Mar 1 in a non-leap year (31 + 28 + 1)', () => {
    expect(dayOfYearIn(new Date('2026-03-01T12:00:00Z'), 'UTC')).toBe(60);
  });

  it('reads the date in the given timezone, not the host', () => {
    // 2026-01-01T00:30Z is still Dec 31 2025 in Los Angeles (UTC-8).
    const instant = new Date('2026-01-01T00:30:00Z');
    expect(dayOfYearIn(instant, 'UTC')).toBe(1);
    expect(dayOfYearIn(instant, 'America/Los_Angeles')).toBe(365);
  });
});

describe('pickForDay', () => {
  const pool = ['a', 'b', 'c', 'd', 'e'];

  it('returns a fixed string as-is, and null for a blank one', () => {
    expect(pickForDay('hello', new Date('2026-05-01T08:00:00Z'), 'UTC')).toBe('hello');
    expect(pickForDay('   ', new Date('2026-05-01T08:00:00Z'), 'UTC')).toBeNull();
  });

  it('returns null for an empty or all-blank array', () => {
    expect(pickForDay([], new Date('2026-05-01T08:00:00Z'), 'UTC')).toBeNull();
    expect(pickForDay(['', '  '], new Date('2026-05-01T08:00:00Z'), 'UTC')).toBeNull();
  });

  it('is deterministic: the same date+tz always picks the same entry', () => {
    const d = new Date('2026-05-10T06:00:00Z');
    expect(pickForDay(pool, d, 'UTC')).toBe(pickForDay(pool, d, 'UTC'));
  });

  it('does not depend on the time of day (same calendar day => same pick)', () => {
    const morning = new Date('2026-05-10T05:00:00Z');
    const evening = new Date('2026-05-10T21:00:00Z');
    expect(pickForDay(pool, morning, 'UTC')).toBe(pickForDay(pool, evening, 'UTC'));
  });

  it('never repeats yesterday: consecutive days always differ', () => {
    let day = new Date('2026-01-01T08:00:00Z');
    for (let i = 0; i < 400; i++) {
      const next = new Date(day.getTime() + 86_400_000);
      expect(pickForDay(pool, day, 'UTC')).not.toBe(pickForDay(pool, next, 'UTC'));
      day = next;
    }
  });

  it('covers the whole pool within one cycle (pool length days)', () => {
    const seen = new Set<string>();
    let day = new Date('2026-04-01T08:00:00Z');
    for (let i = 0; i < pool.length; i++) {
      seen.add(pickForDay(pool, day, 'UTC')!);
      day = new Date(day.getTime() + 86_400_000);
    }
    expect(seen.size).toBe(pool.length);
  });
});
