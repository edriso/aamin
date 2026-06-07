import type { Bot, Context } from 'grammy';
import {
  Scheduler,
  pickContent,
  pickForDay,
  post,
  sendPoll,
  deleteMessage,
  getMessageIds,
  setMessageIds,
  logger,
} from 'telegram-broadcast-kit';
import { schedules } from './schedules';
import type { MessageSchedule, ScheduleDef } from './types';
import { config } from './config';

// The bot-specific layer on top of the kit's generic scheduler: it owns the
// schedule table (what to post), the message/poll dispatch, and the
// ring-buffer cleanup. The kit's Scheduler handles the node-cron registration,
// cron validation, and per-fire error containment (runJob).

/**
 * Run one schedule and return the new message_id (or null if nothing
 * posted). Dispatches on `kind` (message -> post, poll -> sendPoll).
 *
 * Ring buffer: each schedule keeps its last `keepLast` posts live
 * (message default 1, poll default 0 = untracked; see types.ts). Order is
 * post-then-trim so the channel is never briefly empty. A failed post
 * leaves state untouched (next fire retries the cleanup); a failed delete
 * still advances state (a stale orphan is benign). Anything not posted
 * here (manual welcome, other admins) is never tracked, never deleted.
 *
 * Exported so /admin_run fires the exact same path. See CLAUDE.md.
 */
export async function runSchedule(bot: Bot<Context>, def: ScheduleDef): Promise<number | null> {
  if (def.skipIf?.(new Date())) {
    // Guard says don't post this time. Leave the ring buffer untouched,
    // like a no-content fire.
    logger.info('Schedule skipped by guard', { name: def.name });
    return null;
  }

  const keepLast = effectiveKeepLast(def);

  const newId = await sendForKind(bot, def);
  if (newId === null) {
    return null; // post failed: keep tracked ids so the next fire retries cleanup
  }

  if (keepLast === 0) {
    return newId; // not tracked (untracked poll, or an opt-out one-off)
  }

  const previous = getMessageIds(def.name);
  const next = [...previous, newId];
  const toDelete = next.length > keepLast ? next.splice(0, next.length - keepLast) : [];
  await setMessageIds(def.name, next);

  for (const oldId of toDelete) {
    if (oldId === newId) continue; // never delete what we just posted
    await deleteMessage(bot, config.channelChatId, oldId, { name: def.name });
  }

  return newId;
}

/** Resolve keepLast against the kind-default; clamp bad values to 0 so a
 *  config typo can't break the cron tick. */
function effectiveKeepLast(def: ScheduleDef): number {
  if (typeof def.keepLast === 'number' && Number.isInteger(def.keepLast) && def.keepLast >= 0) {
    return def.keepLast;
  }
  return def.kind === 'message' ? 1 : 0;
}

/** Dispatch on kind. Returns the new message_id or null on failure. */
async function sendForKind(bot: Bot<Context>, def: ScheduleDef): Promise<number | null> {
  if (def.kind === 'poll') {
    // `poll` may be a factory rebuilt per fire (day-of-week variants).
    const spec = typeof def.poll === 'function' ? def.poll() : def.poll;
    return sendPoll(bot, config.channelChatId, spec, { name: def.name, silent: def.silent });
  }
  const text = resolveMessageText(def);
  if (!text) {
    logger.warn('Schedule has no content to post, skipping', { name: def.name });
    return null;
  }
  return post(bot, config.channelChatId, text, { name: def.name, silent: def.silent });
}

/**
 * Resolve a message schedule's text for this fire. A factory `content`
 * decides the exact text itself (custom per-day logic, like the bedtime
 * ritual's fixed/rotating alternation); a fixed string or a pool is chosen
 * per `selection`. Returns null when there is nothing postable.
 */
function resolveMessageText(def: MessageSchedule): string | null {
  if (typeof def.content === 'function') return def.content() || null;
  return def.selection === 'daily'
    ? pickForDay(def.content, new Date(), config.timezone)
    : pickContent(def.content);
}

// One Scheduler instance for the whole bot, holding the live cron tasks so
// they can all be stopped on shutdown.
const scheduler = new Scheduler(config.timezone);

/**
 * Register every schedule with the kit's Scheduler. Each cron is validated
 * by the kit (an invalid one is logged and skipped; the rest still run) and
 * every fire is wrapped in the kit's runJob for error containment. Returns
 * the count registered.
 */
export function startScheduler(bot: Bot<Context>): number {
  return scheduler.start(
    schedules.map((def) => ({
      name: def.name,
      cron: def.cron,
      // The Scheduler ignores the returned id, so the wrapper resolves to void.
      run: async () => {
        await runSchedule(bot, def);
      },
    })),
  );
}

export function stopScheduler(): void {
  scheduler.stop();
}
