import { describe, it, expect } from 'vitest';
import cron from 'node-cron';
import { schedules, findSchedule } from './schedules';

/**
 * Guard the runtime schedule table. An invalid cron is silently skipped
 * by startScheduler (the rest still run), so a typo would not throw at
 * boot, it would just mean a post never fires. This test catches that at
 * build time instead.
 */
describe('schedules table', () => {
  it('has the four expected schedules, in real-day order', () => {
    expect(schedules.map((s) => s.name)).toEqual([
      'morning_reminder',
      'friday_family',
      'bedtime_ritual',
      'evening_poll',
    ]);
  });

  it('every cron expression is valid', () => {
    for (const s of schedules) {
      expect(cron.validate(s.cron), `${s.name} has an invalid cron: ${s.cron}`).toBe(true);
    }
  });

  it('schedule names are unique (state keys must not collide)', () => {
    const names = schedules.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('the evening poll replaces itself daily (keepLast = 1)', () => {
    const poll = findSchedule('evening_poll');
    expect(poll?.kind).toBe('poll');
    expect(poll?.keepLast).toBe(1);
  });

  it('the morning reminder keeps every tip (keepLast 0) and picks via a factory', () => {
    const morning = findSchedule('morning_reminder');
    expect(morning?.kind).toBe('message');
    // keepLast 0 => unique tips are never deleted (a growing library).
    expect(morning?.keepLast).toBe(0);
    // The daily rotation is now a factory (pickMorningReminder), not a plain
    // pool + selection: it keys on the epoch-day count and a fixed shuffle so
    // repeats stay a full pool apart and adding tips does not pull a repeat
    // close (the rotation properties are pinned in content.test.ts). The
    // factory also returns a non-empty string for a real day.
    expect(morning?.kind === 'message' && typeof morning.content).toBe('function');
    if (morning?.kind === 'message' && typeof morning.content === 'function') {
      expect((morning.content() ?? '').length).toBeGreaterThan(0);
    }
  });

  it('findSchedule returns undefined for an unknown name', () => {
    expect(findSchedule('does_not_exist')).toBeUndefined();
  });

  // The documented cadence: rings exactly ONCE a day (the morning tip).
  // Everything else rides in silently, so a follower gets one gentle ping.
  it('rings only the morning tip; everything else is silent', () => {
    expect(findSchedule('morning_reminder')?.silent, 'morning tip should ring').not.toBe(true);
    expect(findSchedule('friday_family')?.silent, 'Friday activity should be silent').toBe(true);
    expect(findSchedule('bedtime_ritual')?.silent, 'bedtime ritual should be silent').toBe(true);
    expect(findSchedule('evening_poll')?.silent, 'evening poll should be silent').toBe(true);
  });

  it('the bedtime ritual is a silent nightly message that replaces itself', () => {
    const ritual = findSchedule('bedtime_ritual');
    expect(ritual?.kind).toBe('message');
    expect(ritual?.silent).toBe(true);
    // keepLast omitted => message default 1 (one live "tonight's ritual").
    expect(ritual?.keepLast).toBeUndefined();
    expect(ritual?.cron).toBe('0 21 * * *');
    // Content is a factory: it alternates the fixed card with a pool item
    // night by night (see content/bedtime.ts pickBedtimeContent).
    expect(ritual?.kind === 'message' && typeof ritual.content).toBe('function');
  });

  it('the evening poll follows the ritual (21:30, after 21:00)', () => {
    expect(findSchedule('bedtime_ritual')?.cron).toBe('0 21 * * *');
    expect(findSchedule('evening_poll')?.cron).toBe('30 21 * * *');
  });
});
