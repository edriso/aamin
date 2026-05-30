import { describe, it, expect } from 'vitest';
import { morningReminders } from './morningReminders';
import { fridayFamily } from './fridayFamily';
import { welcomeMessage } from './welcome';

// Telegram single-message hard limit. Our messages are far shorter, but
// guard against a future edit that accidentally pastes a huge block.
const MAX_MESSAGE = 4096;

describe('morningReminders', () => {
  it('has a healthy pool of tips (room for ~a month without repeats)', () => {
    expect(morningReminders.length).toBeGreaterThanOrEqual(28);
  });

  it('every tip is non-blank and within the Telegram message limit', () => {
    for (const tip of morningReminders) {
      expect(tip.trim().length).toBeGreaterThan(0);
      expect(tip.length).toBeLessThanOrEqual(MAX_MESSAGE);
      // Keep them short and morning-friendly, not walls of text.
      expect(tip.length).toBeLessThanOrEqual(900);
    }
  });

  it('has no duplicate tips', () => {
    expect(new Set(morningReminders).size).toBe(morningReminders.length);
  });
});

describe('fridayFamily', () => {
  it('is non-blank and within the message limit', () => {
    expect(fridayFamily.trim().length).toBeGreaterThan(0);
    expect(fridayFamily.length).toBeLessThanOrEqual(MAX_MESSAGE);
  });
});

describe('welcomeMessage', () => {
  it('is non-blank and within the message limit', () => {
    expect(welcomeMessage.trim().length).toBeGreaterThan(0);
    expect(welcomeMessage.length).toBeLessThanOrEqual(MAX_MESSAGE);
  });
});
