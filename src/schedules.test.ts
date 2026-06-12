import { describe, it, expect } from 'vitest';
import cron from 'node-cron';
import { schedules, findSchedule } from './schedules';
import { pollFiresTonight } from './content/poll';
import { isRamadan, isBlessedTenDhulHijjah, isEidDay } from './seasons';

/**
 * Guard the runtime schedule table. An invalid cron is silently skipped
 * by startScheduler (the rest still run), so a typo would not throw at
 * boot, it would just mean a post never fires. This test catches that at
 * build time instead.
 */
describe('schedules table', () => {
  it('has the expected schedules, in real-day (time-of-day) order', () => {
    expect(schedules.map((s) => s.name)).toEqual([
      'morning_reminder', // 07:00
      'eid_greeting', //     08:00 (seasonal)
      'friday_family', //    09:00
      'ramadan_daily', //    16:30 (seasonal)
      'dhulhijjah_daily', // 16:30 (seasonal)
      'bedtime_ritual', //   21:00
      'evening_poll', //     21:30
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

  it('the evening poll replaces itself (keepLast = 1)', () => {
    const poll = findSchedule('evening_poll');
    expect(poll?.kind).toBe('poll');
    expect(poll?.keepLast).toBe(1);
  });

  it('the evening poll runs every other night via skipIf (matches pollFiresTonight)', () => {
    const poll = findSchedule('evening_poll');
    expect(typeof poll?.skipIf).toBe('function');
    // The guard skips exactly the nights pollFiresTonight says not to fire.
    // Walk a fortnight and assert skipIf is the negation of the fire rule,
    // and that fires and skips alternate (no two of either back to back).
    const start = new Date('2026-06-01T18:00:00Z');
    let prevFired: boolean | null = null;
    let fires = 0;
    for (let d = 0; d < 14; d++) {
      const day = new Date(start.getTime() + d * 86_400_000);
      const skipped = poll?.skipIf?.(day) ?? false;
      const fired = !skipped;
      expect(fired).toBe(pollFiresTonight(day, 'Africa/Cairo'));
      if (prevFired !== null) expect(fired).not.toBe(prevFired);
      prevFired = fired;
      if (fired) fires++;
    }
    expect(fires).toBe(7); // half of the fortnight
  });

  it('the always-on posts never skip (only the poll and the seasonal tracks do)', () => {
    expect(findSchedule('morning_reminder')?.skipIf).toBeUndefined();
    expect(findSchedule('bedtime_ritual')?.skipIf).toBeUndefined();
    expect(findSchedule('friday_family')?.skipIf).toBeUndefined();
    expect(typeof findSchedule('evening_poll')?.skipIf).toBe('function');
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
  it('rings only the morning tip; everything else (incl. seasonal) is silent', () => {
    expect(findSchedule('morning_reminder')?.silent, 'morning tip should ring').not.toBe(true);
    for (const name of [
      'eid_greeting',
      'friday_family',
      'ramadan_daily',
      'dhulhijjah_daily',
      'bedtime_ritual',
      'evening_poll',
    ]) {
      expect(findSchedule(name)?.silent, `${name} should be silent`).toBe(true);
    }
  });

  // Seasonal tracks are gated by a Hijri-date skipIf (see seasons.ts): they
  // fire only in season, and the cron itself runs daily. Hijri anchors
  // (Umm al-Qura, 1447) confirmed via Intl.
  it('the seasonal tracks fire only in their Hijri window', () => {
    const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
    const RAMADAN = at('2026-02-19'); // 9/2
    const DHULHIJJAH = at('2026-05-20'); // 12/3
    const EID = at('2026-03-20'); // 10/1
    const ORDINARY = at('2026-01-15'); // no season

    const fires = (name: string, now: Date) => {
      const def = findSchedule(name);
      expect(typeof def?.skipIf, `${name} must have a skipIf`).toBe('function');
      return !def!.skipIf!(now);
    };

    // Each track fires in its own window and nowhere else.
    expect(fires('ramadan_daily', RAMADAN)).toBe(true);
    expect(fires('ramadan_daily', ORDINARY)).toBe(false);
    expect(fires('dhulhijjah_daily', DHULHIJJAH)).toBe(true);
    expect(fires('dhulhijjah_daily', ORDINARY)).toBe(false);
    expect(fires('eid_greeting', EID)).toBe(true);
    expect(fires('eid_greeting', ORDINARY)).toBe(false);

    // The skipIf matches the season predicate it is built from.
    expect(fires('ramadan_daily', RAMADAN)).toBe(isRamadan(RAMADAN, 'Africa/Cairo'));
    expect(fires('dhulhijjah_daily', DHULHIJJAH)).toBe(
      isBlessedTenDhulHijjah(DHULHIJJAH, 'Africa/Cairo'),
    );
    expect(fires('eid_greeting', EID)).toBe(isEidDay(EID, 'Africa/Cairo'));
  });

  it('the seasonal afternoon tracks share the 16:30 slot and are mutually exclusive', () => {
    expect(findSchedule('ramadan_daily')?.cron).toBe('30 16 * * *');
    expect(findSchedule('dhulhijjah_daily')?.cron).toBe('30 16 * * *');
    // They never both fire on the same day (different Hijri months).
    const ramadan = new Date('2026-02-19T12:00:00Z');
    const dh = new Date('2026-05-20T12:00:00Z');
    expect(findSchedule('dhulhijjah_daily')?.skipIf?.(ramadan)).toBe(true); // off in Ramadan
    expect(findSchedule('ramadan_daily')?.skipIf?.(dh)).toBe(true); // off in Dhul-Hijjah
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
