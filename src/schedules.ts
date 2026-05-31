import { morningReminders } from './content/morningReminders';
import { fridayFamily } from './content/fridayFamily';
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
 * exactly twice a day, a morning ping (the tip) and an evening ping (the
 * poll). The weekly Friday family nudge is an extra, so it carries
 * `silent: true` (Telegram disable_notification): it still appears in the
 * channel that morning, it just does not add a third buzz.
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
    // before any repeat (see lib/pick.ts pickForDay).
    selection: 'daily',
    // Keep every tip live (do NOT replace-on-next-fire). Each morning tip
    // is unique, evergreen content, so the channel grows a browsable,
    // shareable library instead of throwing yesterday's away. Only the
    // identical daily poll and weekly Friday message get replaced.
    keepLast: 0,
    description: 'تذكيرٌ تربويٌّ صباحيّ (بالتناوب اليوميّ، لا يتكرّر تذكير الأمس)، كل يوم 7:00 ص.',
  },
  {
    name: 'friday_family',
    kind: 'message',
    // 09:00 Cairo Friday: start of the weekend in most Arab countries.
    cron: '0 9 * * 5',
    content: fridayFamily,
    // No keepLast set => message default 1 (replace-on-next-fire). The
    // Friday message is the same each week, so we keep one live copy
    // instead of stacking 52 identical posts a year.
    // Silent: a weekly extra on top of the daily morning/evening pings, so
    // it arrives without a buzz and Friday stays at two interruptions.
    silent: true,
    description: 'وقفةُ يوم العائلة (وقتٌ للأبناء + سننُ الجمعة)، الجمعة 9:00 ص (صامت).',
  },
  {
    name: 'evening_poll',
    kind: 'poll',
    // 21:00 Cairo: after the children sleep, parents reflect on the day.
    cron: '0 21 * * *',
    // A factory (not a fixed spec) so the poll stays easy to vary later
    // without touching the scheduler. See content/poll.ts.
    poll: () => buildParentingPoll(),
    // Opts the poll into replace-on-next-fire (polls default to 0 =
    // untracked), so exactly one live poll shows: no stack of identical
    // questions burying the pinned welcome.
    keepLast: 1,
    description:
      'استبيان «بمَ أكرمتَ أبناءك اليوم؟» (مجهول)، كل يوم 9:00 م. تُحذَف نسخةُ الأمس عند نشر الجديدة.',
  },
];

/** Lookup helper used by /admin_run. */
export function findSchedule(name: string): ScheduleDef | undefined {
  return schedules.find((s) => s.name === name);
}
