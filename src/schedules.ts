import { pickMorningReminder } from './content/morningReminders';
import { fridayFamily } from './content/fridayFamily';
import { pickBedtimeContent } from './content/bedtime';
import { buildParentingPoll, pollFiresTonight } from './content/poll';
import { pickRamadanContent } from './content/ramadan';
import { pickDhulHijjahContent } from './content/dhulHijjah';
import { pickEidContent } from './content/eid';
import { isRamadan, isBlessedTenDhulHijjah, isEidDay } from './seasons';
import type { ScheduleDef } from './types';

export type { ScheduleDef } from './types';

/**
 * THE FILE TO EDIT. Each entry is one cron rule + what to post:
 *   kind: 'message' -> text: a fixed string, a pool (array, chosen per
 *                      `selection`), or a `() => string` factory for custom
 *                      per-day logic (the bedtime ritual uses a factory)
 *   kind: 'poll'    -> the anonymous evening self-review poll
 *
 * `cron` is a 5-field expression in TZ_NAME (default Africa/Cairo).
 * Day-of-week: 0/7=Sun, 1=Mon, ..., 5=Fri, 6=Sat.
 *
 * Keep times >= 02:00: Cairo springs 00:00->01:00 on the last Friday of
 * April and node-cron silently drops jobs in that missing hour.
 *
 * Cadence is deliberately calm: what hurts retention is the number of
 * separate notification moments, not the message count. This bot rings
 * exactly ONCE a day, the morning tip. Everything else
 * (`silent: true` => Telegram disable_notification) still appears in the
 * channel but adds no buzz: the Friday family activity, the nightly
 * bedtime ritual, the evening reflection poll, and the seasonal tracks. So
 * a follower gets one gentle morning ping and can read the rest whenever
 * they open the app.
 *
 * Seasonal tracks (all silent, all gated by a Hijri-date `skipIf`, see
 * seasons.ts): an afternoon Ramadan nudge (16:30, all of Ramadan), an
 * afternoon Dhul-Hijjah nudge (16:30, the blessed ten 1..9), and a warm
 * Eid greeting (08:00, the first morning of each Eid). They lie dormant
 * out of season; `pnpm send-test` and `/admin_run <name> force` post them
 * anyway for preview.
 *
 * The evening flow is a sequence, not a pile: 21:00 the bedtime ritual
 * (do this WITH your child as you put them down), then 21:30 the poll
 * (reflect on the day once they are asleep). The ritual is nightly; the
 * poll is every OTHER night (see evening_poll's skipIf / pollFiresTonight),
 * landing on the same nights the fixed bedtime card shows, so the anchor
 * night pairs the full card with the full reflection and the off night
 * stays light. Both silent, both keepLast 1, so only the latest is live.
 */
export const schedules: ScheduleDef[] = [
  {
    name: 'morning_reminder',
    kind: 'message',
    // 07:00 Cairo: a calm start to the day, before school/work rush.
    cron: '0 7 * * *',
    // A factory (like the bedtime ritual), not a plain pool + selection,
    // so the pick can use a sturdier equation than the kit's pickForDay:
    // it keys on the epoch-day count (no New-Year stutter) and a fixed
    // deterministic shuffle, so every tip shows once per pool-length days
    // (repeats are always a full pool apart, never "a couple of days"),
    // and ADDING tips reshuffles every slot instead of pinning the old
    // ones to nearby dates. See pickMorningReminder for the full rationale.
    content: () => pickMorningReminder(),
    // Keep every tip live (do NOT replace-on-next-fire). Each morning tip
    // is unique, evergreen content, so the channel grows a browsable,
    // shareable library instead of throwing yesterday's away. Only the
    // daily poll and the rotating weekly Friday activity get replaced.
    keepLast: 0,
    description: 'تذكيرٌ تربويٌّ صباحيّ (بالتناوب اليوميّ، لا يتكرّر تذكير الأمس)، كل يوم 7:00 ص.',
  },
  {
    name: 'eid_greeting',
    kind: 'message',
    // 08:00 Cairo: a warm Eid morning greeting, just after the daily tip.
    // The cron fires every morning; skipIf posts it ONLY on the first day
    // of each Eid (1 Shawwal / 10 Dhul-Hijjah), via the Umm al-Qura Hijri
    // date (see seasons.ts). pickEidContent returns the Fitr or Adha card.
    cron: '0 8 * * *',
    content: () => pickEidContent(),
    skipIf: (now) => !isEidDay(now),
    // keepLast default 1: one live Eid card; replaced next Eid.
    // Silent: the morning tip already rang; the channel keeps its one ring.
    silent: true,
    description: 'تهنئةُ العيد (الفطر والأضحى)، صباحَ العيد 8:00 ص (صامت).',
  },
  {
    name: 'friday_family',
    kind: 'message',
    // 09:00 Cairo Friday: start of the weekend in most Arab countries.
    cron: '0 9 * * 5',
    content: fridayFamily,
    // A rotating pool: each Friday shows one "family activity" from
    // content/fridayFamily.ts, picked deterministically by date (the same
    // Friday everywhere, restart-safe, cycling through the whole pool).
    // The pool size must NOT be a multiple of 7, or the weekly step would
    // land on the same item every Friday (a test guards this).
    selection: 'daily',
    // No keepLast set => message default 1 (replace-on-next-fire). We keep
    // one live copy: "this week's activity". Last week's is deleted so the
    // channel does not stack a year of weekly posts.
    // Silent: a weekly extra on top of the daily morning/evening pings, so
    // it arrives without a buzz and Friday stays at two interruptions.
    silent: true,
    description: 'نشاطُ يوم العائلة (بالتناوب الأسبوعيّ + سننُ الجمعة)، الجمعة 9:00 ص (صامت).',
  },
  {
    name: 'ramadan_daily',
    kind: 'message',
    // 16:30 Cairo: a pre-iftar afternoon nudge, the natural gap in the day
    // (after the 07:00 tip, before the 21:00 bedtime / 21:30 poll). The
    // cron fires daily; skipIf posts it ONLY during Ramadan (Hijri month 9,
    // Umm al-Qura, see seasons.ts). The factory's pick advances with the
    // month and shifts to the last-ten pool from the 21st (see ramadan.ts).
    cron: '30 16 * * *',
    content: () => pickRamadanContent(),
    skipIf: (now) => !isRamadan(now),
    // keepLast default 1: one live "today's Ramadan note", yesterday's
    // removed, so a month of notes does not stack. Silent: keeps the one
    // ring a day (the morning tip); Ramadan adds calm, not buzz.
    silent: true,
    description: 'تذكيرُ رمضان (قبل الإفطار)، أيّامَ رمضان 4:30 م (صامت).',
  },
  {
    name: 'dhulhijjah_daily',
    kind: 'message',
    // 16:30 Cairo, same afternoon slot. Mutually exclusive with Ramadan
    // (different Hijri months), so sharing the time is safe and reads as
    // one "afternoon seasonal" beat. skipIf posts it ONLY on 1..9
    // Dhul-Hijjah (the blessed ten; the 10th is Eid, owned by eid_greeting).
    // pickDhulHijjahContent shows Arafah-specific content on the 9th.
    cron: '30 16 * * *',
    content: () => pickDhulHijjahContent(),
    skipIf: (now) => !isBlessedTenDhulHijjah(now),
    silent: true,
    description: 'تذكيرُ عشر ذي الحجة (ويومُ عرفة)، أيّامَ العشر 4:30 م (صامت).',
  },
  {
    name: 'bedtime_ritual',
    kind: 'message',
    // 21:00 Cairo: bedtime. The reminder to put the child down on dhikr
    // and a hug, so they fall asleep feeling safe (the channel's whole aim).
    cron: '0 21 * * *',
    // A factory called each fire (like the poll), so the content can vary
    // by day: it alternates the fixed full card with a rotating pool item,
    // night by night. See content/bedtime.ts (pickBedtimeContent).
    content: () => pickBedtimeContent(),
    // keepLast default 1: one live "tonight's ritual", last night's deleted.
    // Silent: the day already rang once (the morning tip); bedtime should
    // calm, not buzz. It still appears in the channel for whoever opens it.
    silent: true,
    description: 'طمأنينةُ النوم (بطاقةٌ ثابتة ومجموعةٌ تتناوب ليلةً بليلة)، كل يوم 9:00 م (صامت).',
  },
  {
    name: 'evening_poll',
    kind: 'poll',
    // 21:30 Cairo: after the bedtime ritual and once the children sleep,
    // parents reflect on the day (muhasaba). Half an hour after the ritual
    // so the two evening posts are a sequence, not a bunched-up pair.
    cron: '30 21 * * *',
    // A factory (not a fixed spec) so the poll stays easy to vary later
    // without touching the scheduler. See content/poll.ts.
    poll: () => buildParentingPoll(),
    // Every other night, not nightly: a muhasaba every single evening can
    // grow heavy and lose its weight; alternating keeps it a pause worth
    // waiting for. It fires on the EVEN epoch-nights, the same nights the
    // fixed bedtime card shows, so "full ritual card (21:00) + full
    // reflection (21:30)" pair up on the anchor night, and the off night
    // stays light (a rotating bedtime item, no poll). See pollFiresTonight.
    // skipIf is a pure function of `now`, so the cron still fires at 21:30
    // daily and this guard decides whether to actually post.
    skipIf: (now) => !pollFiresTonight(now),
    // Opts the poll into replace-on-next-fire (polls default to 0 =
    // untracked), so exactly one live poll shows: no stack of identical
    // questions burying the pinned welcome. A skipped night leaves the ring
    // buffer untouched, so the previous poll simply stays until the next one.
    keepLast: 1,
    // Silent: muhasaba is a quiet end-of-day check-in, not a notification
    // to chase. Only the morning tip rings; the poll rides in silently.
    silent: true,
    description:
      'استبيان «بمَ أكرمتَ أبناءك اليوم؟» (مجهول)، كلَّ ليلتَين 9:30 م (صامت). تُحذَف النسخةُ السابقة عند نشر الجديدة.',
  },
];

/** Lookup helper used by /admin_run. */
export function findSchedule(name: string): ScheduleDef | undefined {
  return schedules.find((s) => s.name === name);
}
