/**
 * Shared types for schedules and content.
 *
 * Kept in its own file so content modules can import `PollSpec` without
 * creating an import cycle with `schedules.ts` (which imports content).
 *
 * `PollSpec` is re-exported from telegram-broadcast-kit (the shared kernel
 * owns the poll wire shape, so the schedule defs and the kit's `sendPoll`
 * agree on one type). The bot-specific schedule types below stay local.
 */

import type { PollSpec } from 'telegram-broadcast-kit';

export type { PollSpec } from 'telegram-broadcast-kit';

interface BaseSchedule {
  /** Unique, short id. Used in logs and `/admin_run <name>`. */
  name: string;
  /**
   * Standard 5-field cron, interpreted in TZ_NAME. Day-of-week:
   * 0 or 7 = Sunday, 1 = Monday, ... 5 = Friday, 6 = Saturday.
   */
  cron: string;
  /** Human note shown in `/admin_health`. Optional. */
  description?: string;
  /**
   * Ring-buffer size: how many of this schedule's past posts stay live.
   * After each fire, older posts (oldest first) are deleted.
   *   - omit => 1 for messages (replace-on-next-fire), 0 for polls.
   *   - 0 => never track, never delete (one-off announcements).
   *   - 1 => exactly one live copy.
   *   - N>1 => keep the latest N.
   */
  keepLast?: number;
  /**
   * Optional fire-time guard. If it returns true the fire is skipped:
   * nothing is posted and the ring buffer is left untouched (same effect
   * as empty content). Pure function of `now` so it stays unit-testable.
   * Adding it here (not as a name check in the scheduler) keeps "a new
   * schedule needs no framework change" intact.
   */
  skipIf?: (now: Date) => boolean;
  /**
   * Post silently (Telegram disable_notification): the message still
   * appears in the channel, but the reader's device does not make a sound
   * or vibrate. Used for the weekly Friday family nudge, which is an extra
   * on top of the daily morning ping, so the channel stays at its intended
   * two interruptions a day. Defaults to false (the post rings). See
   * schedules.ts.
   */
  silent?: boolean;
}

/**
 * Posts a text message. `content` may be:
 *   - a fixed string,
 *   - a pool (array), one entry chosen each fire per `selection`, or
 *   - a factory `() => string` called at fire time for custom per-day
 *     logic (mirrors `PollSchedule.poll`). A factory decides the exact
 *     text itself, so `selection` is ignored for it. Used by the bedtime
 *     ritual to alternate a fixed card with a rotating pool day by day.
 */
export interface MessageSchedule extends BaseSchedule {
  kind: 'message';
  content: string | readonly string[] | (() => string);
  /**
   * How an array `content` is chosen each fire (ignored for a fixed string
   * or a factory):
   *   - 'random' (default): one entry at random (pickContent).
   *   - 'daily': deterministic day-of-year rotation (pickForDay), so the
   *     same calendar day always shows the same entry, two consecutive
   *     days never repeat, and the whole pool is covered before any
   *     repeat. Restart-safe (no state). Used by the morning reminder.
   */
  selection?: 'random' | 'daily';
}

/** Sends one anonymous poll. `poll` may be a fixed spec or a factory
 *  called at fire time, so the evening review can vary by day-of-week
 *  (the weekend adds a family-time option) while one schedule + one
 *  state key keeps the replace-on-next-fire cleanup intact. See
 *  content/poll.ts. */
export interface PollSchedule extends BaseSchedule {
  kind: 'poll';
  poll: PollSpec | (() => PollSpec);
}

export type ScheduleDef = MessageSchedule | PollSchedule;
