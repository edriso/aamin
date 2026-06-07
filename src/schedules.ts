import { morningReminders } from './content/morningReminders';
import { fridayFamily } from './content/fridayFamily';
import { bedtimeRitual } from './content/bedtime';
import { buildParentingPoll } from './content/poll';
import type { ScheduleDef } from './types';

export type { ScheduleDef } from './types';

/**
 * THE FILE TO EDIT. Each entry is one cron rule + what to post:
 *   kind: 'message' -> text (fixed string, or random from an array)
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
 * bedtime ritual, and the evening reflection poll. So a follower gets one
 * gentle morning ping and can read the rest whenever they open the app.
 *
 * The evening flow is a sequence, not a pile: 21:00 the bedtime ritual
 * (do this WITH your child as you put them down), then 21:30 the poll
 * (reflect on the day once they are asleep). Both silent, both keepLast 1,
 * so only tonight's pair is ever live.
 */
export const schedules: ScheduleDef[] = [
  {
    name: 'morning_reminder',
    kind: 'message',
    // 07:00 Cairo: a calm start to the day, before school/work rush.
    cron: '0 7 * * *',
    content: morningReminders,
    // Deterministic day-of-year rotation: the same tip on a given date,
    // never the same tip two days running, and the whole pool is shown
    // before any repeat (see telegram-broadcast-kit pickForDay).
    selection: 'daily',
    // Keep every tip live (do NOT replace-on-next-fire). Each morning tip
    // is unique, evergreen content, so the channel grows a browsable,
    // shareable library instead of throwing yesterday's away. Only the
    // daily poll and the rotating weekly Friday activity get replaced.
    keepLast: 0,
    description: 'تذكيرٌ تربويٌّ صباحيّ (بالتناوب اليوميّ، لا يتكرّر تذكير الأمس)، كل يوم 7:00 ص.',
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
    name: 'bedtime_ritual',
    kind: 'message',
    // 21:00 Cairo: bedtime. The reminder to put the child down on dhikr
    // and a hug, so they fall asleep feeling safe (the channel's whole aim).
    cron: '0 21 * * *',
    // A fixed nightly card by default. To rotate instead, import
    // { bedtimeRituals } here and set `content: bedtimeRituals` +
    // `selection: 'daily'` (see content/bedtime.ts for the one-line switch).
    content: bedtimeRitual,
    // keepLast default 1: one live "tonight's ritual", last night's deleted.
    // Silent: the day already rang once (the morning tip); bedtime should
    // calm, not buzz. It still appears in the channel for whoever opens it.
    silent: true,
    description: 'طمأنينةُ النوم (أذكارُ النوم + حضنٌ ودعاء)، كل يوم 9:00 م (صامت).',
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
    // Opts the poll into replace-on-next-fire (polls default to 0 =
    // untracked), so exactly one live poll shows: no stack of identical
    // questions burying the pinned welcome.
    keepLast: 1,
    // Silent: muhasaba is a quiet end-of-day check-in, not a notification
    // to chase. Only the morning tip rings; the poll rides in silently.
    silent: true,
    description:
      'استبيان «بمَ أكرمتَ أبناءك اليوم؟» (مجهول)، كل يوم 9:30 م (صامت). تُحذَف نسخةُ الأمس عند نشر الجديدة.',
  },
];

/** Lookup helper used by /admin_run. */
export function findSchedule(name: string): ScheduleDef | undefined {
  return schedules.find((s) => s.name === name);
}
