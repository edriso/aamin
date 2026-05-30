# آمَن (aamin)

A calm Telegram channel bot for Arab Muslim parents. It posts gentle
daily reminders that help you raise your children with love and rifq
(gentleness) on the guidance of the Prophet ﷺ, and an anonymous evening
self-review so you can quietly check in on your day with your kids.

The goal in one word is **aman** (أمان): a child who is met with mercy,
fairness, attention, and kept promises grows up feeling safe.

This bot is a sibling of `zaaduna` and `sql-ninjas` and follows the same
shape: a tiny, source-driven, no-database channel broadcaster.

## What it posts

All times are in `TZ_NAME` (default `Africa/Cairo`). The user-facing
content is in clear Arabic.

| Schedule           | When                | What                                                        |
| ------------------ | ------------------- | ----------------------------------------------------------- |
| `morning_reminder` | every day 07:00     | one gentle parenting tip, picked at random from a pool      |
| `friday_family`    | Friday 09:00        | a weekly "family time" nudge + a touch of Friday sunnah     |
| `evening_poll`     | every day 21:00     | anonymous, multi-answer poll: "what did you do today?"      |

The evening poll is **anonymous and multi-answer**: parents tick what
they managed today, everyone sees aggregate percentages, and nobody (not
even the bot) learns who voted. There is no database. On the weekend
(Fri/Sat) it adds a "family time" option.

Only `evening_poll` is replaced each day (`keepLast: 1`), so the channel
never stacks identical polls on top of the pinned welcome.

## Content authenticity

The reminders are drawn from the Quran, authentic Sunnah, and sound
parenting wisdom. Anything attributed to the Prophet ﷺ is **sahih or
hasan**, with the takhreej (source + grading) noted in a code comment
above each item. Disputed or weak material (and the disputed "beating"
clause of the prayer hadith) is deliberately left out, in keeping with
the channel's tone of mercy. Have a trusted scholar review the content
once before any expansion.

## Project layout

```
src/
  index.ts                entry point: config -> state -> bot -> scheduler -> health
  config.ts               env validation (throws early; validates the IANA timezone)
  types.ts                ScheduleDef + PollSpec types
  schedules.ts            THE EDIT POINT: cron + what to post
  scheduler.ts            node-cron registration + runSchedule (ring-buffer cleanup)
  bot.ts                  grammY bot: /start + /admin_health + /admin_run
  health.ts               /health HTTP endpoint
  content/
    morningReminders.ts   the pool of morning tips (with takhreej comments)
    fridayFamily.ts       the weekly family-time message
    poll.ts               buildParentingPoll(): the evening poll factory
    welcome.ts            the pinned welcome message
  lib/
    logger.ts             ISO-timestamped structured logger
    post.ts               sendMessage / sendPoll / deleteMessage wrappers (no parse_mode)
    state.ts              the message-id pointer file (replace-on-next-fire)
    pick.ts               random pick from a content array
scripts/
  send-test.ts            fire every schedule once, for a live preview
  post-welcome.ts         post or edit-in-place the pinned welcome
```

## Setup

Requirements: Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env      # then fill in BOT_TOKEN and CHANNEL_CHAT_ID
```

Create the channel, add your bot as an admin with **Post messages** and
**Delete messages** rights (the second lets it replace the previous
poll), then fill `.env`.

## Scripts

```bash
pnpm dev            # run with reload (tsx watch)
pnpm build          # tsc -> dist/
pnpm start          # run the built bot
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run
pnpm format         # prettier --write
pnpm check          # typecheck + test
pnpm send-test      # fire every schedule once into the channel (preview)
pnpm post-welcome   # post the pinned welcome (pass a message_id to edit in place)
```

First run, in order:

```bash
pnpm post-welcome   # post the welcome, then pin it by hand in Telegram
pnpm send-test      # preview a full day of content in the channel
pnpm dev            # or pnpm start in production
```

## How it works

- **No database.** All content lives in `src/content/*.ts`. The only
  persisted state is a tiny JSON pointer file that remembers the last
  message_id per schedule, so the "replace the previous poll" cleanup
  survives a restart. Lose it and the bot still runs; it just leaks one
  stale message until the next cycle.
- **No parse_mode.** Arabic and Quran text contains characters that make
  Telegram's Markdown/HTML parser return a 400, so every send is plain
  text. Poll lines are wrapped in a Unicode bidi isolate for correct RTL
  rendering next to the vote percentages.
- **Timezone-aware.** All cron fires and the poll's weekend detection use
  `Intl` against `TZ_NAME`, not the host clock.
- **Let it crash, restart clean.** Uncaught errors exit so the supervisor
  restarts from a clean state; SIGINT/SIGTERM shut down gracefully with a
  timeout cap.

## License

0BSD.
