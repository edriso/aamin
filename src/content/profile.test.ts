import { describe, it, expect } from 'vitest';
import { botAbout, botDescription } from './profile';

// Telegram Bot API hard limits. setBotProfile() (src/bot.ts) is awaited at
// startup, so an overflow here is not cosmetic: setMyShortDescription /
// setMyDescription return 400 and the bot crashes on boot. These tests
// catch an over-long edit at build time instead. About is deliberately
// close to the cap (it is the richest 120 chars we can show), so the guard
// matters most there.
const MAX_ABOUT = 120; // setMyShortDescription
const MAX_DESCRIPTION = 512; // setMyDescription

describe('bot profile text', () => {
  it('About is non-blank and within the 120-char limit', () => {
    expect(botAbout.trim().length).toBeGreaterThan(0);
    expect(botAbout.length).toBeLessThanOrEqual(MAX_ABOUT);
  });

  it('Description is non-blank and within the 512-char limit', () => {
    expect(botDescription.trim().length).toBeGreaterThan(0);
    expect(botDescription.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });
});
