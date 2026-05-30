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
 * separate notification moments, not the message count. This bot is at
 * most two interruptions a day (a morning ping, an evening ping), plus a
 * weekly Friday family nudge bundled into the morning slot.
 */
export const schedules: ScheduleDef[] = [
  {
    name: 'morning_reminder',
    kind: 'message',
    // 07:00 Cairo: a calm start to the day, before school/work rush.
    cron: '0 7 * * *',
    // Array form: one gentle tip is picked at random per fire so the
    // morning feels fresh (see lib/pick.ts and content/morningReminders.ts).
    content: morningReminders,
    description: 'تذكيرٌ تربويٌّ صباحيّ (يُختار عشوائيًّا)، كل يوم 7:00 ص.',
  },
  {
    name: 'friday_family',
    kind: 'message',
    // 09:00 Cairo Friday: start of the weekend in most Arab countries.
    cron: '0 9 * * 5',
    content: fridayFamily,
    description: 'وقفةُ يوم العائلة (وقتٌ للأبناء + سننُ الجمعة)، الجمعة 9:00 ص.',
  },
  {
    name: 'evening_poll',
    kind: 'poll',
    // 21:00 Cairo: after the children sleep, parents reflect on the day.
    cron: '0 21 * * *',
    // Factory, rebuilt each fire so the weekend (Fri/Sat) adds a
    // family-time option (see poll.ts), while one schedule + one state
    // key keeps cleanup simple.
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
