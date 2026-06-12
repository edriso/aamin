import { describe, it, expect } from 'vitest';
import { ramadanGeneral, ramadanLastTen, pickRamadanContent } from './ramadan';
import { dhulHijjahDays, dhulHijjahArafah, pickDhulHijjahContent } from './dhulHijjah';
import { eidAlFitr, eidAlAdha, pickEidContent } from './eid';

const MAX_MESSAGE = 4096; // Telegram single-message hard limit.
const TZ = 'Africa/Cairo';
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

// Hijri anchors (Umm al-Qura, 1447, confirmed via Intl).
const RAMADAN_D1 = at('2026-02-18'); // 9/1
const RAMADAN_D21 = at('2026-03-10'); // 9/21 (last-ten begins)
const DHULHIJJAH_D1 = at('2026-05-18'); // 12/1
const ARAFAH = at('2026-05-26'); // 12/9
const EID_FITR = at('2026-03-20'); // 10/1
const EID_ADHA = at('2026-05-27'); // 12/10

/** First code point of a string (the leading emoji, here). */
const lead = (s: string) => Array.from(s.trim())[0];

// Pools share this shape, so check them the same way.
const pools: Array<[string, readonly string[]]> = [
  ['ramadanGeneral', ramadanGeneral],
  ['ramadanLastTen', ramadanLastTen],
  ['dhulHijjahDays', dhulHijjahDays],
];

describe('seasonal content pools', () => {
  for (const [name, pool] of pools) {
    describe(name, () => {
      it('is non-empty and every item is non-blank within the message limit', () => {
        expect(pool.length).toBeGreaterThanOrEqual(2);
        for (const item of pool) {
          expect(item.trim().length).toBeGreaterThan(0);
          expect(item.length).toBeLessThanOrEqual(MAX_MESSAGE);
          expect(item.length).toBeLessThanOrEqual(900); // keep them readable
        }
      });

      it('has no duplicate items', () => {
        expect(new Set(pool).size).toBe(pool.length);
      });

      it('opens each item with a distinct leading emoji', () => {
        const leads = pool.map(lead);
        expect(new Set(leads).size).toBe(leads.length);
      });

      it('uses no off-tone emoji (rainbow / vigil candle / Diwali lamp)', () => {
        for (const item of pool) {
          expect(item).not.toContain('🌈'); // rainbow
          expect(item).not.toContain('🕯️'); // reads as a church/vigil candle
          expect(item).not.toContain('🪔'); // Diwali lamp
        }
      });
    });
  }
});

describe('Ramadan pick (advances with the month)', () => {
  it('shows a general-pool item in the first 20 days', () => {
    expect(ramadanGeneral).toContain(pickRamadanContent(RAMADAN_D1, TZ));
  });

  it('switches to the last-ten pool from the 21st', () => {
    expect(ramadanLastTen).toContain(pickRamadanContent(RAMADAN_D21, TZ));
  });

  it('never repeats on consecutive days, across the whole month', () => {
    for (let i = 0; i < 29; i++) {
      expect(pickRamadanContent(plusDays(RAMADAN_D1, i), TZ)).not.toBe(
        pickRamadanContent(plusDays(RAMADAN_D1, i + 1), TZ),
      );
    }
  });

  it('covers the general pool over the first 20 days and the last-ten pool after', () => {
    const general = new Set<string>();
    for (let i = 0; i < 20; i++) general.add(pickRamadanContent(plusDays(RAMADAN_D1, i), TZ));
    expect(general.size).toBe(ramadanGeneral.length);
    const lastTen = new Set<string>();
    for (let i = 20; i < 30; i++) lastTen.add(pickRamadanContent(plusDays(RAMADAN_D1, i), TZ));
    expect(lastTen.size).toBe(ramadanLastTen.length);
  });
});

describe('Dhul-Hijjah pick', () => {
  it('shows the Arafah card on the 9th', () => {
    expect(pickDhulHijjahContent(ARAFAH, TZ)).toBe(dhulHijjahArafah);
  });

  it('shows a rotating day item on days 1..8', () => {
    for (let i = 0; i < 8; i++) {
      expect(dhulHijjahDays).toContain(pickDhulHijjahContent(plusDays(DHULHIJJAH_D1, i), TZ));
    }
  });

  it('never repeats on consecutive days through the ten', () => {
    for (let i = 0; i < 8; i++) {
      expect(pickDhulHijjahContent(plusDays(DHULHIJJAH_D1, i), TZ)).not.toBe(
        pickDhulHijjahContent(plusDays(DHULHIJJAH_D1, i + 1), TZ),
      );
    }
  });
});

describe('Eid pick', () => {
  it('returns the Fitr card in Shawwal and the Adha card in Dhul-Hijjah', () => {
    expect(pickEidContent(EID_FITR, TZ)).toBe(eidAlFitr);
    expect(pickEidContent(EID_ADHA, TZ)).toBe(eidAlAdha);
  });

  it('both Eid cards are non-blank within the message limit', () => {
    for (const card of [eidAlFitr, eidAlAdha]) {
      expect(card.trim().length).toBeGreaterThan(0);
      expect(card.length).toBeLessThanOrEqual(MAX_MESSAGE);
    }
  });
});

// Verbatim-quote and weak-material guards (see CLAUDE.md content rules). The
// research pack flagged the exact traps; these pin that we avoided them.
describe('seasonal content authenticity guards', () => {
  const allRamadan = [...ramadanGeneral, ...ramadanLastTen];
  const allSeasonal = [...allRamadan, ...dhulHijjahDays, dhulHijjahArafah, eidAlFitr, eidAlAdha];

  // dhikr / Quran / takbir must never be framed as a song or performance
  // (scholars discourage rendering Allah's words as anasheed). For takbir we
  // use the sunnah framing of الجهر (raising the voice), not «نشيد». The
  // «غناء جاريتين» in eid.ts is a verbatim hadith reference, so it is allowed.
  it('never frames dhikr/takbir as a song (نشيد/أنشودة/أغنية/أناشيد)', () => {
    // Note: «لحن» is intentionally NOT checked as a bare substring — it
    // matches «الحنان» (affection), a word the channel uses constantly. The
    // distinctive song nouns below carry the off-tone framing on their own.
    for (const text of allSeasonal) {
      for (const word of ['نشيد', 'أنشودة', 'أغنية', 'أناشيد']) {
        expect(text.includes(word), `off-tone song word "${word}" in seasonal content`).toBe(false);
      }
    }
    // The takbir item frames it as the sunnah of raising the voice instead.
    expect(dhulHijjahDays.some((t) => t.includes('ارفَعوا بها أصواتكم'))).toBe(true);
  });

  it('uses the hasan iftar dua and never the weak «اللهم لك صمت»', () => {
    expect(
      allRamadan.some((t) => t.includes('ذهب الظمأ وابتلّت العروق وثبت الأجر إن شاء الله')),
    ).toBe(true);
    for (const t of allRamadan) expect(t).not.toContain('لك صمت');
  });

  it('keeps the suhoor lafz exact and drops the weak «وخير سحوركم التمر»', () => {
    expect(allRamadan.some((t) => t.includes('تسحّروا فإنّ في السحور بركة'))).toBe(true);
    for (const t of allRamadan) expect(t).not.toContain('وخير سحوركم');
  });

  it('quotes the Laylat al-Qadr dua without the unestablished «كريم»', () => {
    const dua = ramadanLastTen.find((t) => t.includes('فاعفُ عني'));
    expect(dua).toBeDefined();
    expect(dua).toContain('عفوٌّ تحبّ العفوَ فاعفُ عني');
    expect(dua).not.toContain('كريم'); // the verbatim trap
  });

  it('quotes Bukhari’s lafz for the best-ten-days hadith', () => {
    expect(
      dhulHijjahDays.some((t) =>
        t.includes('ولا الجهاد، إلا رجلٌ خرج يُخاطر بنفسه وماله فلم يرجع بشيء'),
      ),
    ).toBe(true);
  });

  it('renders the Arafah expiation as Muslim’s wording', () => {
    expect(dhulHijjahArafah).toContain('يُكفّر السنةَ التي قبله والسنةَ التي بعده');
    expect(dhulHijjahArafah).toContain('رواه مسلم');
  });

  it('keeps the Eid quotes exact (joy, udhiyah, tashreeq, gift)', () => {
    expect(eidAlFitr).toContain('إنّ لكلِّ قومٍ عيدًا، وهذا عيدنا');
    expect(eidAlFitr).toContain('تهادَوا تحابُّوا');
    expect(eidAlAdha).toContain('ضحّى النبيُّ ﷺ بكبشين أملحين أقرنين، ذبحهما بيده، وسمّى وكبّر');
    expect(eidAlAdha).toContain('أيّامُ أكلٍ وشربٍ وذكرٍ لله');
  });
});
