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

## What it posts (all times in TZ_NAME, default Africa/Cairo)

- `morning_reminder` (message, daily 07:00): one gentle parenting tip,
  picked at random from `src/content/morningReminders.ts`.
- `friday_family` (message, Friday 09:00): a weekly family-time nudge
  plus a touch of Friday sunnah, `src/content/fridayFamily.ts`.
- `evening_poll` (poll, daily 21:00): anonymous, multi-answer self-review,
  built by `buildParentingPoll()` in `src/content/poll.ts`. `keepLast: 1`
  so only one live poll exists at a time. The weekend (Fri/Sat) adds a
  family-time option.

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
- All day/time logic (cron, weekend detection in the poll) uses `Intl`
  against `config.timezone`, never the host clock. `config.ts` validates
  the IANA timezone and throws at startup on a typo.
- Telegram poll limits enforced by `poll.test.ts`: question <=300 chars,
  2..10 options, each <=98 (we leave 2 chars of headroom for the bidi
  isolate). Keep the emoji at the END of each option (a leading emoji
  collides with the vote percentage).
- The morning pool uses the random-array content path (`pickContent`).
  Keep the pool large enough (>=28) to feel fresh; a test asserts this.

## Commands

Standard set: `dev`, `build`, `start`, `typecheck`, `test`, `format`,
`check`, plus `send-test` (preview a full day in the channel) and
`post-welcome` (post/edit the pinned welcome). See README for the
first-run order.
