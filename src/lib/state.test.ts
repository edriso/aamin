import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  initState,
  getMessageIds,
  setMessageIds,
  getLastMessageId,
  setLastMessageId,
  _resetForTests,
} from './state';

let dir: string;
let file: string;

beforeEach(async () => {
  _resetForTests();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aamin-state-'));
  file = path.join(dir, 'last-message-ids.json');
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('initState', () => {
  it('starts empty when the file does not exist', async () => {
    await initState(file);
    expect(getMessageIds('anything')).toEqual([]);
  });

  it('starts empty (no throw) when the file is corrupt JSON', async () => {
    await fs.writeFile(file, '{ not json', 'utf8');
    await initState(file);
    expect(getMessageIds('anything')).toEqual([]);
  });

  it('loads an existing array-shaped file', async () => {
    await fs.writeFile(file, JSON.stringify({ evening_poll: [1, 2, 3] }), 'utf8');
    await initState(file);
    expect(getMessageIds('evening_poll')).toEqual([1, 2, 3]);
  });

  it('migrates the legacy { name: number } shape to an array', async () => {
    await fs.writeFile(file, JSON.stringify({ morning_reminder: 42 }), 'utf8');
    await initState(file);
    expect(getMessageIds('morning_reminder')).toEqual([42]);
  });

  it('drops non-positive-integer ids defensively', async () => {
    await fs.writeFile(file, JSON.stringify({ a: [1, -2, 3.5, 'x', 4] }), 'utf8');
    await initState(file);
    expect(getMessageIds('a')).toEqual([1, 4]);
  });
});

describe('set/get message ids', () => {
  it('persists ids atomically and reloads them', async () => {
    await initState(file);
    await setMessageIds('evening_poll', [10, 11]);

    // A fresh load proves it actually hit disk.
    _resetForTests();
    await initState(file);
    expect(getMessageIds('evening_poll')).toEqual([10, 11]);
  });

  it('an empty array clears the key', async () => {
    await initState(file);
    await setMessageIds('k', [1]);
    await setMessageIds('k', []);
    expect(getMessageIds('k')).toEqual([]);
  });

  it('getLastMessageId returns the newest id', async () => {
    await initState(file);
    await setMessageIds('k', [1, 2, 3]);
    expect(getLastMessageId('k')).toBe(3);
  });

  it('setLastMessageId replaces the buffer with a single id', async () => {
    await initState(file);
    await setMessageIds('k', [1, 2, 3]);
    await setLastMessageId('k', 9);
    expect(getMessageIds('k')).toEqual([9]);
  });

  it('works in-memory only when initState was never called (tests)', async () => {
    // No initState here: setMessageIds must not throw and must hold state.
    await setMessageIds('k', [7]);
    expect(getMessageIds('k')).toEqual([7]);
  });

  it('returns a copy, not the internal array (callers cannot mutate state)', async () => {
    await setMessageIds('k', [1, 2]);
    const got = getMessageIds('k');
    got.push(999);
    expect(getMessageIds('k')).toEqual([1, 2]);
  });
});
