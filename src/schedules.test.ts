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
  it('has the three expected schedules', () => {
    expect(schedules.map((s) => s.name)).toEqual([
      'morning_reminder',
      'friday_family',
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

  it('findSchedule returns undefined for an unknown name', () => {
    expect(findSchedule('does_not_exist')).toBeUndefined();
  });
});
