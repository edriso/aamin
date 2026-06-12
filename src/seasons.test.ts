import { describe, it, expect } from 'vitest';
import {
  hijriDate,
  isRamadan,
  isBlessedTenDhulHijjah,
  isArafah,
  isEidAlFitr,
  isEidAlAdha,
  isEidDay,
} from './seasons';

// Fixed Gregorian dates and their Umm al-Qura Hijri equivalents in Cairo,
// confirmed directly from Intl (1447 AH). Noon UTC stays the same calendar
// day in Africa/Cairo, so these are stable anchors.
const TZ = 'Africa/Cairo';
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

const RAMADAN_D1 = at('2026-02-18'); // 9/1
const RAMADAN_D21 = at('2026-03-10'); // 9/21
const EID_FITR = at('2026-03-20'); // 10/1
const DHULHIJJAH_D1 = at('2026-05-18'); // 12/1
const ARAFAH = at('2026-05-26'); // 12/9
const EID_ADHA = at('2026-05-27'); // 12/10
const TASHREEQ = at('2026-05-28'); // 12/11 (after the ten + Eid)
const ORDINARY = at('2026-01-15'); // 7/26, no season

describe('hijriDate (Umm al-Qura via Intl)', () => {
  it('reads the expected Hijri month and day for known dates', () => {
    expect(hijriDate(RAMADAN_D1, TZ)).toMatchObject({ month: 9, day: 1 });
    expect(hijriDate(EID_FITR, TZ)).toMatchObject({ month: 10, day: 1 });
    expect(hijriDate(ARAFAH, TZ)).toMatchObject({ month: 12, day: 9 });
    expect(hijriDate(EID_ADHA, TZ)).toMatchObject({ month: 12, day: 10 });
    expect(hijriDate(RAMADAN_D1, TZ).year).toBe(1447);
  });

  it('is timezone-pure: the same instant resolves per the given tz', () => {
    // An instant near midnight can be different Hijri days in different zones.
    const instant = new Date('2026-02-18T23:30:00Z');
    const cairo = hijriDate(instant, 'Africa/Cairo');
    const honolulu = hijriDate(instant, 'Pacific/Honolulu');
    // Cairo is already the 19th (past midnight); Honolulu still the 18th.
    expect(cairo.day).not.toBe(honolulu.day);
  });
});

describe('season predicates', () => {
  it('isRamadan is true across Ramadan and false otherwise', () => {
    expect(isRamadan(RAMADAN_D1, TZ)).toBe(true);
    expect(isRamadan(RAMADAN_D21, TZ)).toBe(true);
    expect(isRamadan(EID_FITR, TZ)).toBe(false);
    expect(isRamadan(ORDINARY, TZ)).toBe(false);
  });

  it('isBlessedTenDhulHijjah covers days 1..9 only (Eid day 10 excluded)', () => {
    expect(isBlessedTenDhulHijjah(DHULHIJJAH_D1, TZ)).toBe(true);
    expect(isBlessedTenDhulHijjah(ARAFAH, TZ)).toBe(true); // day 9
    expect(isBlessedTenDhulHijjah(EID_ADHA, TZ)).toBe(false); // day 10 = Eid
    expect(isBlessedTenDhulHijjah(TASHREEQ, TZ)).toBe(false); // day 11
    expect(isBlessedTenDhulHijjah(RAMADAN_D1, TZ)).toBe(false);
  });

  it('isArafah is exactly 9 Dhul-Hijjah', () => {
    expect(isArafah(ARAFAH, TZ)).toBe(true);
    expect(isArafah(DHULHIJJAH_D1, TZ)).toBe(false);
    expect(isArafah(EID_ADHA, TZ)).toBe(false);
  });

  it('isEidAlFitr / isEidAlAdha mark exactly the first day of each Eid', () => {
    expect(isEidAlFitr(EID_FITR, TZ)).toBe(true);
    expect(isEidAlFitr(EID_ADHA, TZ)).toBe(false);
    expect(isEidAlAdha(EID_ADHA, TZ)).toBe(true);
    expect(isEidAlAdha(EID_FITR, TZ)).toBe(false);
  });

  it('isEidDay is true on either Eid and false otherwise', () => {
    expect(isEidDay(EID_FITR, TZ)).toBe(true);
    expect(isEidDay(EID_ADHA, TZ)).toBe(true);
    expect(isEidDay(ARAFAH, TZ)).toBe(false);
    expect(isEidDay(ORDINARY, TZ)).toBe(false);
  });

  it('the seasons are mutually exclusive on any given day', () => {
    // No date is ever in two tracks at once (Ramadan / Dhul-Hijjah ten / Eid).
    for (const d of [RAMADAN_D1, RAMADAN_D21, DHULHIJJAH_D1, ARAFAH, EID_FITR, EID_ADHA]) {
      const flags = [isRamadan(d, TZ), isBlessedTenDhulHijjah(d, TZ), isEidDay(d, TZ)];
      expect(flags.filter(Boolean).length).toBe(1);
    }
    // And an ordinary day is in none.
    expect(
      [
        isRamadan(ORDINARY, TZ),
        isBlessedTenDhulHijjah(ORDINARY, TZ),
        isEidDay(ORDINARY, TZ),
      ].filter(Boolean).length,
    ).toBe(0);
  });
});

describe('season detection across many years', () => {
  // Real Umm al-Qura first-day anchors for several Hijri years (confirmed
  // via Intl). 1454 is deliberately included: its Ramadan starts in Dec 2032
  // and its Eid al-Fitr falls in Jan 2033, so the season spans the Gregorian
  // New Year — proving detection never depends on the Gregorian year.
  const ANCHORS = [
    {
      y: 1447,
      ramadan: '2026-02-18',
      fitr: '2026-03-20',
      arafah: '2026-05-26',
      adha: '2026-05-27',
    },
    {
      y: 1448,
      ramadan: '2027-02-08',
      fitr: '2027-03-09',
      arafah: '2027-05-15',
      adha: '2027-05-16',
    },
    {
      y: 1450,
      ramadan: '2029-01-16',
      fitr: '2029-02-14',
      arafah: '2029-04-23',
      adha: '2029-04-24',
    },
    {
      y: 1454,
      ramadan: '2032-12-04',
      fitr: '2033-01-03',
      arafah: '2033-03-11',
      adha: '2033-03-12',
    },
  ];

  for (const a of ANCHORS) {
    it(`detects every season correctly for ${a.y} AH`, () => {
      const R = at(a.ramadan);
      expect(hijriDate(R, TZ)).toMatchObject({ year: a.y, month: 9, day: 1 });
      expect(isRamadan(R, TZ)).toBe(true);

      const F = at(a.fitr);
      expect(hijriDate(F, TZ)).toMatchObject({ month: 10, day: 1 });
      expect(isEidAlFitr(F, TZ)).toBe(true);
      expect(isEidDay(F, TZ)).toBe(true);
      expect(isRamadan(F, TZ)).toBe(false);

      const AR = at(a.arafah);
      expect(hijriDate(AR, TZ)).toMatchObject({ month: 12, day: 9 });
      expect(isArafah(AR, TZ)).toBe(true);
      expect(isBlessedTenDhulHijjah(AR, TZ)).toBe(true);
      expect(isEidDay(AR, TZ)).toBe(false);

      const AD = at(a.adha);
      expect(hijriDate(AD, TZ)).toMatchObject({ month: 12, day: 10 });
      expect(isEidAlAdha(AD, TZ)).toBe(true);
      expect(isEidDay(AD, TZ)).toBe(true);
      expect(isBlessedTenDhulHijjah(AD, TZ)).toBe(false); // day 10 is Eid, not the ten
    });
  }

  it('Ramadan spans the Gregorian New Year without a stutter (1454 AH)', () => {
    // Ramadan 1454: 2032-12-04 .. 2033-01-02 (Eid al-Fitr 2033-01-03).
    expect(isRamadan(at('2032-12-20'), TZ)).toBe(true); // late Dec 2032
    expect(isRamadan(at('2033-01-01'), TZ)).toBe(true); // same Ramadan, new Greg year
    expect(isRamadan(at('2033-01-05'), TZ)).toBe(false); // after Eid
  });

  it('stays structurally sound and non-overlapping every day across ~9 years', () => {
    // Sweep ~9 Gregorian years day by day and tally structural violations,
    // then assert once (faster and clearer than thousands of in-loop expects).
    const start = Date.UTC(2026, 0, 1, 12);
    const days = 365 * 9;
    let overlaps = 0;
    let badRamadan = 0;
    let badTen = 0;
    let badArafah = 0;
    let badFitr = 0;
    let badAdha = 0;
    let badEidDay = 0;
    let ramadan = 0;
    let fitr = 0;
    let adha = 0;
    let arafah = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(start + i * 86_400_000);
      const h = hijriDate(d, TZ);
      const r = isRamadan(d, TZ);
      const b = isBlessedTenDhulHijjah(d, TZ);
      const ef = isEidAlFitr(d, TZ);
      const ea = isEidAlAdha(d, TZ);
      const e = isEidDay(d, TZ);
      const ar = isArafah(d, TZ);
      if ([r, b, e].filter(Boolean).length > 1) overlaps++;
      if (r) {
        ramadan++;
        if (h.month !== 9) badRamadan++;
      }
      if (b) {
        if (h.month !== 12 || h.day < 1 || h.day > 9) badTen++;
      }
      if (ar) {
        arafah++;
        if (!(b && !e && h.month === 12 && h.day === 9)) badArafah++;
      }
      if (ef) {
        fitr++;
        if (!(h.month === 10 && h.day === 1)) badFitr++;
      }
      if (ea) {
        adha++;
        if (!(h.month === 12 && h.day === 10)) badAdha++;
      }
      if (e !== (ef || ea)) badEidDay++;
    }
    // No overlaps and no structural violations on any of the ~3285 days.
    expect(overlaps).toBe(0);
    expect([badRamadan, badTen, badArafah, badFitr, badAdha, badEidDay]).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
    // Each event occurs about once per Hijri year (~9 across ~9 Greg years).
    expect(ramadan).toBeGreaterThan(9 * 28); // ~9 Ramadans of 29-30 days
    expect(fitr).toBeGreaterThanOrEqual(8);
    expect(adha).toBeGreaterThanOrEqual(8);
    expect(arafah).toBeGreaterThanOrEqual(8);
  });
});
