# CLAUDE.md (aamin)

Project-specific notes for the "آمِن" (aamin) bot. The shared conventions
live in `../CLAUDE.md` at the `bots/` root; this file only covers what is
specific to this project. Easy English on purpose, no em dashes.

## What this bot is

A calm Telegram channel bot for Arab Muslim parents. It gently reminds
them to raise their children with love and rifq, and to make their kids
feel safe (aman). It is a sibling of `zaaduna` and `sql-ninjas`: a tiny,
single-package, no-database, source-driven channel broadcaster (NOT the
workspace + Prisma shape from the shared CLAUDE.md; this bot needs no db).

User-facing content is in clear Arabic. Code, comments, and docs are in
easy English.

## Shared kernel

The generic plumbing — `logger`, `env`, `bidi` (`rtlIsolate`), `pickContent`/`pickForDay`, the
JSON-pointer `state`, `post`/`sendPoll`/`deleteMessage`, the cron `Scheduler`, and the `/health`
server — comes from **`telegram-broadcast-kit`** (pinned by tag in `package.json`, auto-bumped by
Renovate). aamin keeps only what is aamin-specific: its schedule table, content, the poll builder,
and the `runSchedule` dispatch. Mentions of `lib/post.ts` below now refer to the kit's `post`
module. To change shared code, edit the kit and ship a new tag (see its README).

## What it posts (all times in TZ_NAME, default Africa/Cairo)

- `morning_reminder` (message, daily 07:00): one gentle parenting tip from
  `src/content/morningReminders.ts`, chosen by deterministic daily
  rotation (`selection: 'daily'`, no consecutive repeats). `keepLast: 0`
  so every unique tip is kept as a growing library, never deleted. The
  pool has two voices: most tips face the child (what to do with them),
  and a "sakina" strand (a labelled section at the end of the file) faces
  the parent's own heart, because a calm parent is the child's first
  aman. A test pins that the sakina strand stays present.
- `friday_family` (message, Friday 09:00): a weekly family-time nudge from
  a rotating pool in `src/content/fridayFamily.ts` — each Friday is one
  "family activity" (mostly kind-speech and du'a games between siblings)
  plus a touch of Friday sunnah. `selection: 'daily'` rotates the pool
  deterministically by date. The pool size must NOT be a multiple of 7 (a
  weekly fire steps day-of-year by 7, so a multiple of 7 would freeze on
  one item every Friday — a test in `content.test.ts` guards this).
  Default `keepLast: 1` keeps one live copy ("this week's activity"), last
  week's is deleted. Carries `silent: true` (Telegram
  `disable_notification`): it is a weekly extra on top of the daily
  morning/evening pings, so it arrives without a buzz and the channel
  stays at its two-interruptions-a-day cadence.
- `evening_poll` (poll, daily 21:00): anonymous, multi-answer self-review,
  built by `buildParentingPoll()` in `src/content/poll.ts`. 10 options on
  weekdays; Fri/Sat add a family-time option (11). Telegram's max is 12
  (Bot API 9.1+). `keepLast: 1` so only one live poll exists at a time.

`schedules.ts` is THE EDIT POINT: one cron rule + what to post per entry.

## Content rules (important)

- Anything attributed to the Prophet ﷺ must be **sahih or hasan**. Put
  the takhreej (source + grading) in a comment above the item, as the
  existing content does. When unsure, verify before adding.
- Avoid weak (da'if) material as proof, and avoid the disputed "beating"
  clause of the age-ten prayer hadith. The channel's whole tone is mercy.
- Keep the wording warm, MSA, and tie each tip back to the child's sense
  of security (aman).
- A trusted scholar should review the content once before any expansion.

## Conventions specific to this bot

- No `parse_mode` on any send (Arabic/Quran text 400s Markdown/HTML).
  Poll lines go through `rtlIsolate()` in `lib/post.ts` for RTL rendering.
- Notification cadence: rings twice a day (morning tip + evening poll). A
  schedule may set `silent: true` (only `friday_family` does today); the
  scheduler passes it to `lib/post.ts`, which adds `disable_notification`.
  A schedules test pins which posts ring vs ride in silently.
- All day/time logic (cron, the morning tip's daily rotation, the poll's
  weekend detection) uses `Intl` against `config.timezone`, never the host
  clock. `config.ts` validates the IANA timezone and throws at startup on
  a typo.
- Telegram poll limits enforced by `poll.test.ts`: question <=300 chars,
  2..12 options (Bot API 9.1+ raised the max from 10 to 12), each <=98 (we
  leave 2 chars of headroom for the bidi isolate). Keep the emoji at the
  END of each option (a leading emoji collides with the vote percentage).
- The morning pool rotates deterministically by day-of-year
  (`pickForDay`), so a follower never sees yesterday's tip again today and
  the whole pool is covered before any repeat. Keep the pool large enough
  (>=28); a test asserts this and that consecutive days never collide.

## Commands

Standard set: `dev`, `build`, `start`, `typecheck`, `test`, `format`,
`check`, plus `send-test` (preview a full day in the channel) and
`post-welcome` (post/edit the pinned welcome). See README for the
first-run order.
