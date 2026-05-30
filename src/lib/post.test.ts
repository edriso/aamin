import { describe, it, expect, vi } from 'vitest';
import type { Bot, Context } from 'grammy';
import {
  postToChannel,
  deleteChannelMessage,
  sendPollToChannel,
  rtlIsolate,
  MIN_CLOSE_HOURS,
  MAX_CLOSE_HOURS,
} from './post';

// U+2067 RIGHT-TO-LEFT ISOLATE, U+2069 POP DIRECTIONAL ISOLATE.
const RLI = String.fromCodePoint(0x2067);
const PDI = String.fromCodePoint(0x2069);

function fakeBot() {
  const sendMessage = vi.fn().mockResolvedValue({ message_id: 11 });
  const sendPoll = vi.fn().mockResolvedValue({ message_id: 22 });
  const deleteMessage = vi.fn().mockResolvedValue(true);
  const bot = { api: { sendMessage, sendPoll, deleteMessage } } as unknown as Bot<Context>;
  return { bot, sendMessage, sendPoll, deleteMessage };
}

describe('rtlIsolate', () => {
  it('wraps text in RLI...PDI bidi isolates', () => {
    expect(rtlIsolate('abc')).toBe(`${RLI}abc${PDI}`);
  });
});

describe('postToChannel', () => {
  it('returns the message_id on success and sends NO parse_mode', async () => {
    const { bot, sendMessage } = fakeBot();
    const id = await postToChannel(bot, 'مرحبا');
    expect(id).toBe(11);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    // Arabic text must go out as plain text (no parse_mode -> no 400).
    const [, text, opts] = sendMessage.mock.calls[0];
    expect(text).toBe('مرحبا');
    expect(opts).toBeUndefined();
  });

  it('returns null (does not throw) when the API rejects', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('429'));
    const bot = { api: { sendMessage } } as unknown as Bot<Context>;
    await expect(postToChannel(bot, 'hi')).resolves.toBeNull();
  });
});

describe('deleteChannelMessage', () => {
  it('returns true on success', async () => {
    const { bot } = fakeBot();
    await expect(deleteChannelMessage(bot, 5)).resolves.toBe(true);
  });

  it('returns false (does not throw) when delete fails', async () => {
    const deleteMessage = vi.fn().mockRejectedValue(new Error('not found'));
    const bot = { api: { deleteMessage } } as unknown as Bot<Context>;
    await expect(deleteChannelMessage(bot, 5)).resolves.toBe(false);
  });
});

describe('sendPollToChannel', () => {
  it('isolates the question + options and sets anonymous/multi/close_date', async () => {
    const { bot, sendPoll } = fakeBot();
    const before = Math.floor(Date.now() / 1000);
    const id = await sendPollToChannel(bot, {
      question: 'س؟',
      options: ['أ', 'ب'],
      closeAfterHours: 5,
    });
    expect(id).toBe(22);

    const [, question, options, opts] = sendPoll.mock.calls[0];
    expect(question).toBe(`${RLI}س؟${PDI}`);
    expect(options).toEqual([{ text: `${RLI}أ${PDI}` }, { text: `${RLI}ب${PDI}` }]);
    expect(opts.is_anonymous).toBe(true);
    expect(opts.allows_multiple_answers).toBe(true);
    // 5 hours from now, give or take a couple seconds of test runtime.
    expect(opts.close_date).toBeGreaterThanOrEqual(before + 5 * 3600);
    expect(opts.close_date).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 5 * 3600 + 5);
  });

  it('clamps an absurd closeAfterHours into Telegram range', async () => {
    const { bot, sendPoll } = fakeBot();
    const now = Math.floor(Date.now() / 1000);
    await sendPollToChannel(bot, { question: 'q', options: ['a', 'b'], closeAfterHours: 10_000 });
    const opts = sendPoll.mock.calls[0][3];
    // Never beyond ~30 days from now.
    expect(opts.close_date).toBeLessThanOrEqual(now + MAX_CLOSE_HOURS * 3600 + 5);
    expect(opts.close_date).toBeGreaterThan(now + MIN_CLOSE_HOURS * 3600);
  });

  it('returns null (does not throw) when sendPoll rejects', async () => {
    const sendPoll = vi.fn().mockRejectedValue(new Error('boom'));
    const bot = { api: { sendPoll } } as unknown as Bot<Context>;
    await expect(
      sendPollToChannel(bot, { question: 'q', options: ['a', 'b'] }),
    ).resolves.toBeNull();
  });
});
