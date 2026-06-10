# آمِن (aamin)

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

| Schedule           | When                | What                                                          | Notification |
| ------------------ | ------------------- | ------------------------------------------------------------ | ------------ |
| `morning_reminder` | every day 07:00     | one gentle parenting tip, rotated daily through a pool        | rings        |
| `friday_family`    | Friday 09:00        | a rotating weekly "family activity" + a touch of Friday sunnah | silent     |
| `bedtime_ritual`   | every day 21:00     | a nightly "put them to bed on dhikr + a hug" ritual card       | silent      |
| `evening_poll`     | every day 21:30     | anonymous, multi-answer poll: "what did you do today?"        | silent       |

The channel is deliberately calm: it rings **exactly once a day** (the
morning tip). Everything else is sent **silently** (Telegram
`disable_notification`) — the Friday activity, the nightly bedtime ritual,
and the evening poll all appear in the channel but add no buzz. So a
follower gets one gentle morning ping and reads the rest whenever they open
the app. The flag is `silent: true` on those entries in `src/schedules.ts`.

The evening is a small **sequence**, not a pile: 21:00 the bedtime ritual
(do it *with* your child as you put them down), then 21:30 the reflection
poll (a quiet end-of-day check-in once they are asleep).

The evening poll is **anonymous and multi-answer**: parents tick what
they managed today (affection, play, listening, patience without
insults, fairness, keeping promises, du'a, teaching, managing screen
time, a calm bedtime), everyone sees aggregate percentages, and nobody
(not even the bot) learns who voted. There is no database. It is 10 options on
weekdays; on the weekend (Fri/Sat) it adds a "family time" option (11).
Telegram allows up to 12.

> The weekend "family time" poll option shows on **both Friday and
> Saturday** (the weekend in most Arab countries) — that is on purpose,
> not a bug. It is a separate thing from the `friday_family` message,
> which posts on Friday only. The poll picks the day with `Intl` in
> `TZ_NAME`, so "Saturday" is Saturday in Cairo, not on the host clock.

The morning tip uses **deterministic daily rotation**: the same tip on a
given date, never the same tip two days running, and the whole pool is
shown before any repeat (no state needed, so it is restart-safe). The pool
mixes two voices: most tips face the child (what to do with them), and a
**sakina** strand faces the parent's own heart (a calm parent is the
child's first safety), because you cannot give a gentleness you have lost
in yourself.

The **Friday family post also rotates**: each week it shows one short
"family activity" from a pool — mostly small kind-speech and du'a games
between siblings (a blessing phrase for the week, a du'a circle at lunch,
telling a sibling one kind thing) — plus the recurring Friday sunnah. Only
this week's activity stays live. One caution for maintainers: because
Friday fires weekly, the pool size must **not** be a multiple of 7, or the
rotation would land on the same activity every Friday. A test enforces it.

The **bedtime ritual** is the channel's most on-the-nose aman moment: the
sunnah of sleep (wudu, Ayat al-Kursi, the Mu'awwidhat with the
blow-and-wipe, the sleeping du'a) ending in a hug and "I love you", so the
child falls asleep feeling safe. It **alternates night by night**: one
night the **fixed full card**, the next a single **rotating pool item**,
then the card again, and so on. So you get both the anchoring of a repeated
ritual and the freshness of variety — and both halves are actually used (no
dead content). This is done with a small `content` **factory**
(`pickBedtimeContent` in `src/content/bedtime.ts`), the message-side
equivalent of the poll's factory. The flip uses **epoch-day parity** (not
day-of-year) so it never stutters at the year boundary, and the pool steps
one item per pool-night so it fully rotates at any size.

What gets replaced vs kept:

- `morning_reminder` is **kept** (`keepLast: 0`). Each tip is unique,
  evergreen content, so the channel grows a browsable, shareable library.
- `friday_family`, `bedtime_ritual`, and `evening_poll` are **replaced**
  each cycle (`keepLast: 1`): only "this week's family activity", tonight's
  bedtime ritual, and the latest poll should be live, so a single copy of
  each keeps the channel clean and never buries the pinned welcome. (The
  Friday activity rotates weekly — see above — but only the current one
  stays live.)

## Content authenticity

The reminders are drawn from the Quran, authentic Sunnah, and sound
parenting wisdom. Anything attributed to the Prophet ﷺ is **sahih or
hasan**, with the takhreej (source + grading) noted in a code comment
above each item. Disputed or weak material (and the disputed "beating"
clause of the prayer hadith) is deliberately left out, in keeping with
the channel's tone of mercy. Have a trusted scholar review the content
once before any expansion.

When a hadith is quoted between «...» with an attribution like `(رواه
البخاري)`, the words inside the guillemets are the **exact** narration,
checked letter-for-letter against a trusted source. When only the meaning
is conveyed (or the literal wording would read awkwardly in context), the
sentence is paraphrased **without** «...» so it never poses as a verbatim
quote. See `CLAUDE.md` for the full rule and the worked examples (the
Ayat al-Kursi protection clause, and the three-times nafth at bedtime).

## Project layout

This bot keeps only what is aamin-specific. The generic plumbing (logger,
env loading, the bidi RTL helper, content pickers, the message-id state
file, the `post`/`sendPoll`/`deleteMessage` wrappers, the cron `Scheduler`,
and the `/health` server) lives in the shared **`telegram-broadcast-kit`**
package, pinned by tag in `package.json`. To change shared code, edit the
kit and ship a new tag (see its README), not this repo.

```
src/
  index.ts                entry point: config -> state -> profile -> scheduler -> health
  config.ts               env validation (throws early; validates the IANA timezone)
  types.ts                ScheduleDef + PollSpec types (PollSpec re-exported from the kit)
  schedules.ts            THE EDIT POINT: cron + what to post
  scheduler.ts            runSchedule: kind dispatch + ring-buffer cleanup (on the kit's Scheduler)
  bot.ts                  grammY bot: /start + /admin_health + /admin_run, and self-set profile
  content/
    morningReminders.ts   the morning tips: child-facing + a parent sakina strand
    fridayFamily.ts       the rotating weekly family-activity pool
    bedtime.ts            the nightly bedtime ritual (alternates a fixed card + rotating pool)
    poll.ts               buildParentingPoll(): the evening poll factory
    profile.ts            the bot's About + Description text (self-set on startup)
    welcome.ts            the pinned welcome message
scripts/
  send-test.ts            fire every schedule once, for a live preview
  post-welcome.ts         post or edit-in-place the pinned welcome
```

Tests live beside the code (`schedules.test.ts`, `content/poll.test.ts`,
`content/content.test.ts`, `content/profile.test.ts`, etc.); run them with
`pnpm test`.

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
  persisted state is a tiny JSON pointer file that remembers the id of each
  "keep one live" post (the latest poll, the weekly Friday activity, and
  tonight's bedtime ritual), so the "replace the previous one" cleanup
  survives a restart. The morning tips are kept, so they are never tracked.
  Lose the file and the bot still runs; it just leaks one stale post per
  schedule until the next cycle.
- **No parse_mode.** Arabic and Quran text contains characters that make
  Telegram's Markdown/HTML parser return a 400, so every send is plain
  text. Poll lines are wrapped in a Unicode bidi isolate for correct RTL
  rendering next to the vote percentages.
- **Timezone-aware.** All cron fires, the morning tip's daily rotation,
  and the poll's weekend detection use `Intl` against `TZ_NAME`, not the
  host clock.
- **Let it crash, restart clean.** Uncaught errors exit so the supervisor
  restarts from a clean state; SIGINT/SIGTERM shut down gracefully with a
  timeout cap.

## License

0BSD.
