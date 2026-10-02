// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useConsoleStore } from './console-store';
import type { ConsoleLogEntry } from '../../shared/ipc-channels';

const entry = (id: number, message: string): ConsoleLogEntry => ({ id, timestamp: 0, level: 'info', message });

beforeEach(() => useConsoleStore.getState().clearLogs());

describe('console log ids', () => {
  it('stay unique when two sources number their entries from the same start', () => {
    const { addLog } = useConsoleStore.getState();
    // The MAVLink log and the unified logger each count from 1.
    addLog(entry(1, 'Connected'));
    addLog(entry(1, '[MAIN] started'));
    addLog(entry(2, 'Armed state'));
    addLog(entry(2, '[MAIN] ready'));

    const { logs } = useConsoleStore.getState();
    expect(logs.map((l) => l.message)).toEqual(['Connected', '[MAIN] started', 'Armed state', '[MAIN] ready']);
    expect(new Set(logs.map((l) => l.id)).size).toBe(4);
  });
});
