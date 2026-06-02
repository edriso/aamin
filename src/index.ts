import { config } from './config';
import { bot, setBotProfile } from './bot';
import { startScheduler, stopScheduler } from './scheduler';
import { startHealthServer, logger, initState } from 'telegram-broadcast-kit';

async function main() {
  logger.info('Channel bot starting...', {
    timezone: config.timezone,
    isDev: config.isDev,
    channelChatId: config.channelChatId,
  });

  // Load the pointer file before the scheduler so the first fire already
  // knows which previous message (if any) to delete.
  await initState(config.stateFilePath);

  await setBotProfile();
  startScheduler(bot);
  startHealthServer();

  // Not awaited: start() resolves only when the bot stops, and we want
  // main() to return so the signal handlers below are armed. But a fatal
  // polling failure (e.g. a bad token surfaced after boot) rejects this
  // promise; catch it so it crashes cleanly (let-it-crash, restart fresh)
  // instead of becoming an unhandledRejection. A normal bot.stop() during
  // shutdown resolves rather than rejects, so this only fires on errors.
  bot
    .start({
      onStart: () => {
        logger.info('Bot is running. Press Ctrl+C to stop.');
      },
    })
    .catch((err) => {
      if (shuttingDown) return;
      logger.error('Bot polling failed', { error: String(err) });
      process.exit(1);
    });
}

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return; // a second signal must not race the first
  shuttingDown = true;
  logger.info(`${signal} received, shutting down...`);
  stopScheduler();

  // Await bot.stop() so an in-flight update isn't cut off, but cap the
  // wait so a stuck network call can't hang shutdown forever.
  try {
    await Promise.race([bot.stop(), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  } catch (err) {
    logger.error('Error while stopping the bot', { error: String(err) });
  }
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

main().catch(async (err) => {
  logger.error('Fatal error', { error: String(err) });
  // Delay before exit so a misconfigured deploy doesn't spin a tight
  // restart loop on platforms that restart immediately.
  await new Promise((r) => setTimeout(r, 30_000));
  process.exit(1);
});
