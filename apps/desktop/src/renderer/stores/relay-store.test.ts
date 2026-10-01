// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const vehicleCommand = vi.fn();
(window as unknown as { electronAPI: unknown }).electronAPI = { vehicleCommand };

const { useRelayStore, relayButtonState, CONFIRM_TIMEOUT_MS, STALE_MS, FAILED_SHOWN_MS } = await import('./relay-store');

const V = 'udp:1';
const state = (instance: number, now?: number) => relayButtonState(useRelayStore.getState(), V, instance, now);

beforeEach(() => {
  vi.useFakeTimers();
  vehicleCommand.mockReset().mockResolvedValue(true);
  useRelayStore.setState({ status: {}, pending: {}, failed: {} });
});
afterEach(() => vi.useRealTimers());

describe('relay buttons', () => {
  it('starts with low beam on RELAY1 and marker lights on RELAY2', () => {
    const [low, marker] = useRelayStore.getState().buttons;
    expect([low!.instance, marker!.instance]).toEqual([0, 1]);
  });

  it('shows the state the vehicle reports, and nothing it has not reported', () => {
    expect(state(0)).toBe('unknown');
    useRelayStore.getState().recordStatus(V, 0b01, 0b11);
    expect(state(0)).toBe('on');
    expect(state(1)).toBe('off');
    expect(state(2)).toBe('absent'); // not configured on the flight controller
  });

  it('treats an old report as unknown', () => {
    useRelayStore.getState().recordStatus(V, 0b01, 0b01);
    expect(state(0, Date.now() + STALE_MS + 1)).toBe('unknown');
  });

  it('waits for the vehicle to confirm a click, then shows it on', async () => {
    useRelayStore.getState().recordStatus(V, 0, 0b11);
    const done = useRelayStore.getState().setRelay(V, 1, true);
    expect(state(1)).toBe('pending');
    await Promise.resolve();
    expect(vehicleCommand).toHaveBeenCalledWith(V, { kind: 'relay', instance: 1, on: true });
    useRelayStore.getState().recordStatus(V, 0b10, 0b11);
    expect(state(1)).toBe('on');
    await vi.advanceTimersByTimeAsync(CONFIRM_TIMEOUT_MS);
    await done;
    expect(state(1)).toBe('on'); // the confirmed click is not later marked failed
  });

  it('says so when the vehicle never confirms, until it reports the wanted state', async () => {
    useRelayStore.getState().recordStatus(V, 0, 0b01);
    const done = useRelayStore.getState().setRelay(V, 0, true);
    await vi.advanceTimersByTimeAsync(CONFIRM_TIMEOUT_MS);
    await done;
    useRelayStore.getState().recordStatus(V, 0, 0b01); // still off
    expect(state(0)).toBe('failed');
    expect(state(0, Date.now() + FAILED_SHOWN_MS + 1)).toBe('unknown'); // stale by then too
    useRelayStore.getState().recordStatus(V, 0b01, 0b01); // switched after all
    expect(state(0)).toBe('on');
  });

  it('fails at once when the command could not be sent', async () => {
    vehicleCommand.mockResolvedValue(false);
    await useRelayStore.getState().setRelay(V, 0, true);
    expect(state(0)).toBe('failed');
  });
});
