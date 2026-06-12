import { Bot, Context } from 'grammy';
import { logger } from 'telegram-broadcast-kit';
import { config } from './config';
import { botAbout, botDescription } from './content/profile';
import { schedules, findSchedule } from './schedules';
import { runSchedule } from './scheduler';

const bot = new Bot<Context>(config.botToken);

/**
 * Gate for /admin_* commands: true only for a DM from the configured
 * admin. The private-chat check stops the commands firing (and leaking
 * channel internals) in any group the bot is in. No admin id => no-op.
 */
function isAdmin(ctx: Context): boolean {
  if (config.adminTelegramId === null) return false;
  if (ctx.chat?.type !== 'private') return false;
  return ctx.from ? BigInt(ctx.from.id) === config.adminTelegramId : false;
}

/** Plain-text list of every schedule name, for the /admin_run hints. */
function scheduleNameList(): string {
  return schedules.map((s) => `  - ${s.name}`).join('\n');
}

// /start in DM: the bot is channel-first, so this just explains itself.
bot.command('start', async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  const link = config.channelUrl;
  await ctx.reply(
    'السلام عليكم ورحمة الله 🌿\n' +
      'هذه قناة «آمِن» للآباء والأمهات: تذكيراتٌ لطيفة تُعينك على تربية أبنائك بالحبّ والرفق على هَدْي النبيّ ﷺ، وزرعِ الأمان في قلوبهم.\n' +
      'لا يوجد ما تتفاعل معه هنا؛ تابِع القناة لتصلك التذكيرات بإذن الله.' +
      // One link after the message (a URL needs no translation).
      (link ? `\n\n📢 ${link}` : ''),
  );
});

// /admin_health: an "is it up?" snapshot in DM. Plain text (no
// parse_mode), same reason as the channel posts.
bot.command('admin_health', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const uptime = Math.floor(process.uptime());
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const mins = Math.floor((uptime % 3600) / 60);

  let now: string;
  try {
    now = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.timezone,
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: false,
    }).format(new Date());
  } catch {
    now = `${new Date().toISOString()} (UTC; TZ_NAME invalid)`;
  }

  const lines = [
    'Health',
    '------',
    `Uptime: ${days}d ${hours}h ${mins}m`,
    `Now: ${now} (${config.timezone})`,
    `Channel: ${config.channelChatId}${config.channelUrl ? ` (${config.channelUrl})` : ''}`,
    `Schedules registered: ${schedules.length}`,
  ];
  for (const s of schedules) {
    lines.push(`  - ${s.name} [${s.kind}] (${s.cron})`);
  }
  await ctx.reply(lines.join('\n'));
});

// /admin_run <name>: manually fire one schedule via the same path the
// cron uses (a real end-to-end test). A null result means "nothing
// posted" (empty content or a failed send), so the reply says both.
bot.command('admin_run', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const raw = ctx.message?.text ?? '';
  const args = raw
    .replace(/^\/admin_run(@\S+)?\s*/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const name = args[0] ?? '';
  // `force` bypasses a schedule's skipIf, so an admin can preview a
  // season-gated post (Ramadan/Dhul-Hijjah/Eid) or the every-other-night
  // poll on an off night. See runSchedule.
  const force = args.slice(1).includes('force');
  if (!name) {
    await ctx.reply(
      `Usage: /admin_run <schedule-name> [force]\n\nSchedules:\n${scheduleNameList()}`,
    );
    return;
  }
  const def = findSchedule(name);
  if (!def) {
    await ctx.reply(`Unknown schedule: ${name}\n\nSchedules:\n${scheduleNameList()}`);
    return;
  }
  try {
    const messageId = await runSchedule(bot, def, { force });
    if (messageId === null) {
      if (!force && def.skipIf?.(new Date())) {
        await ctx.reply(
          `"${name}" is out of season (or off-night) right now, so its guard ` +
            `skipped it. To preview it anyway:\n  /admin_run ${name} force`,
        );
      } else {
        await ctx.reply(
          `"${name}" did not post.\n` +
            'Either its content was empty, or the Telegram send failed, ' +
            'most often because the bot is not a channel admin with the "Post ' +
            'messages" permission. Check the process logs for the exact error.',
        );
      }
    } else {
      await ctx.reply(`Posted "${name}" to the channel (message ${messageId}).`);
    }
  } catch (err) {
    logger.error('admin_run threw', { name, error: String(err) });
    await ctx.reply(`"${name}" threw an unexpected error: ${String(err)}`);
  }
});

bot.catch((err) => {
  logger.error('Bot error', { error: String(err.error), update: err.ctx.update.update_id });
});

async function setBotProfile() {
  await bot.api.setMyCommands([{ command: 'start', description: 'عن هذا البوت' }]);
  // Set the About (short description) and Description over the Bot API too, so
  // the bot is self-describing on deploy — no manual @BotFather step. (The name
  // and profile photo cannot be set via the Bot API; those stay in @BotFather.)
  await bot.api.setMyShortDescription(botAbout);
  await bot.api.setMyDescription(botDescription);
}

export { bot, setBotProfile };
