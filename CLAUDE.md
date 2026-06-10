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
  `src/content/morningReminders.ts`. The pick is a **factory**
  (`content: () => pickMorningReminder()`), NOT a plain pool +
  `selection: 'daily'`, because the kit's `pickForDay` keys on
  `(day-of-year) % poolSize` and that has two flaws: it stutters at the
  New Year (day-of-year resets but the pool size rarely divides 365), and
  it pulls a repeat CLOSE whenever the pool size changes — appended tips
  keep their low indices, so a tip shown days ago under the smaller pool
  can reappear almost immediately under the larger one (this is exactly
  what caused "أصغِ إليه" to repeat two days apart after the sakina strand
  was added). `pickMorningReminder` fixes both: it keys on the **epoch-day
  count** (`dayNumberIn`, monotonic, no New-Year reset) and a **fixed
  deterministic shuffle** of the index space, so every tip shows exactly
  once every `poolSize` days (repeats are ALWAYS a full pool apart, never
  "a couple of days"), no two consecutive days repeat, the whole pool is
  covered before any repeat, and adding tips RESHUFFLES every slot instead
  of pinning the old ones to nearby dates. It is pure (takes `now`/`tz`)
  and restart-safe (no state). `content.test.ts` pins the spacing,
  coverage, no-consecutive, and year-boundary properties. `keepLast: 0`
  so every unique tip is kept as a growing library, never deleted. The
  pool has two voices: most tips face the child (what to do with them),
  and a "sakina" strand (a labelled section at the end of the file) faces
  the parent's own heart, because a calm parent is the child's first
  aman. A test pins that the sakina strand stays present. The pool size is
  free (no multiple-of-7 constraint — that only applies to the WEEKLY
  Friday pool); a bigger pool simply widens the gap between repeats.
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
- `bedtime_ritual` (message, daily 21:00, silent): the nightly "put your
  child to bed on dhikr + a hug so they sleep feeling safe" reminder, the
  most literal expression of the channel's aman aim. Its `content` is a
  **factory** (`() => pickBedtimeContent()`, like the poll's factory) that
  **alternates night by night**: even nights show the fixed full card
  (`bedtimeRitual`), odd nights a rotating pool item (`bedtimeRituals`),
  all in `src/content/bedtime.ts`. So both are live (no dead content), and
  you get the anchoring of a repeated card plus the freshness of variety.
  Alternation uses **epoch-day parity** (not day-of-year) so the flip never
  stutters at the year boundary, and the pool steps one item per pool-night
  so it fully rotates at any size. `keepLast: 1` => one live "tonight's
  ritual". Bedtime adhkar are famous sahih texts (Bukhari/Muslim) with
  takhreej in comments.
- `evening_poll` (poll, daily 21:30, silent): anonymous, multi-answer
  self-review (muhasaba), built by `buildParentingPoll()` in
  `src/content/poll.ts`. 10 options on weekdays; Fri/Sat add a family-time
  option (11). Telegram's max is 12 (Bot API 9.1+). `keepLast: 1` so only
  one live poll exists at a time. Fires 30 min after the ritual so the two
  evening posts are a sequence (do-the-ritual, then reflect), not a pile.

`schedules.ts` is THE EDIT POINT: one cron rule + what to post per entry.

## Content rules (important)

- Anything attributed to the Prophet ﷺ must be **sahih or hasan**. Put
  the takhreej (source + grading) in a comment above the item, as the
  existing content does. When unsure, verify before adding.
- **Verbatim rule for quotes.** When hadith text sits inside guillemets
  («...») AND carries an attribution such as "rawahu al-Bukhari", the
  words between the guillemets MUST be the exact wording of that
  narration. Verify them letter-for-letter against a trusted source
  (sunnah.com, dorar.net) before committing. The small things silently
  break it: the person (second vs third), a dropped clitic (the dua is
  "wa-bi-nabiyyik", not "wa-nabiyyik"), a missing word (the smile hadith
  ends "laka sadaqa"), or quoting one collection's lafz while citing two.
- If you only want the MEANING, or the exact words read awkwardly in
  context, paraphrase it WITHOUT guillemets. An unquoted sentence may
  still carry a source pointer, because the guillemets are what claim
  "these are the hadith's exact words". Two such paraphrases already live
  in `bedtime.ts`: the Ayat al-Kursi protection clause (Bukhari 2311 is
  second-person, "lan yazala alayka... wa-la yaqrabaka... hatta tusbih";
  we state the meaning in the third person, unquoted, with the original
  lafz kept in a takhreej comment), and the nafth/mu'awwidhat done THREE
  times ("thalatha marrat", Bukhari 5017) — keep that detail.
- Avoid weak (da'if) material as proof, and avoid the disputed "beating"
  clause of the age-ten prayer hadith. The channel's whole tone is mercy.
- Keep the wording warm, MSA, and tie each tip back to the child's sense
  of security (aman).
- Emoji: each tip/activity opens with ONE leading emoji (the poll keeps
  its emoji at the END of the option, see below). Pick calm, family- and
  faith-friendly emojis that render well on Telegram (hearts, nature,
  mosque/moon, hands), keep them distinct within a pool (no duplicate
  leading emoji in `morningReminders.ts`), and avoid harsh or off-tone
  signs (e.g. a red 🚫). **Do NOT use the 🌈 (rainbow) emoji anywhere** —
  it carries connotations that do not fit the channel.
- A trusted scholar should review the content once before any expansion.

## Conventions specific to this bot

- No `parse_mode` on any send (Arabic/Quran text 400s Markdown/HTML).
  Poll lines go through `rtlIsolate()` in `lib/post.ts` for RTL rendering.
- Notification cadence: rings exactly ONCE a day (the morning tip).
  Everything else sets `silent: true` (the Friday activity, the nightly
  bedtime ritual, and the evening poll); the scheduler passes it to the
  kit's `post`/`sendPoll`, which add `disable_notification`. So a follower
  gets one gentle morning ping and reads the rest whenever they open the
  app. A schedules test pins that only the morning tip rings.
- All day/time logic (cron, the morning tip's daily rotation, the poll's
  weekend detection) uses `Intl` against `config.timezone`, never the host
  clock. `config.ts` validates the IANA timezone and throws at startup on
  a typo.
- Telegram poll limits enforced by `poll.test.ts`: question <=300 chars,
  2..12 options (Bot API 9.1+ raised the max from 10 to 12), each <=98 (we
  leave 2 chars of headroom for the bidi isolate). Keep the emoji at the
  END of each option (a leading emoji collides with the vote percentage).
- The morning pool rotates via `pickMorningReminder` (epoch-day count +
  fixed deterministic shuffle, see the `morning_reminder` notes above), so
  a follower never sees yesterday's tip again today, the whole pool is
  covered before any repeat, repeats stay a full pool apart, and adding
  tips never pulls a repeat close. Keep the pool large enough (>=28); a
  test asserts this and that consecutive days never collide. (The kit's
  `pickForDay` is still used for the WEEKLY Friday pool.)
- The bot self-sets its About (<=120 chars) and Description (<=512) on
  startup via the Bot API (`setBotProfile` in `bot.ts`, text in
  `content/profile.ts`). These are awaited before the scheduler, so an
  over-long edit would 400 and crash on boot; `profile.test.ts` guards
  both limits (About sits at 119/120, one edit from the cap). The pinned
  welcome (`content/welcome.ts`) is posted manually via `pnpm post-welcome`
  and is capped at 4096; if schedule times change, update it by hand.

## Commands

Standard set: `dev`, `build`, `start`, `typecheck`, `test`, `format`,
`check`, plus `send-test` (preview a full day in the channel) and
`post-welcome` (post/edit the pinned welcome). See README for the
first-run order.
