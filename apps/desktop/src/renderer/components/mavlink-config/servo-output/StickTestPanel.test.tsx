// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StickTestPanel } from './StickTestPanel';
import { useConnectionStore } from '../../../stores/connection-store';
import { useParameterStore } from '../../../stores/parameter-store';

const armDisarm = vi.fn(async () => true);
const overrideRelease = vi.fn(async () => true);
const setMode = vi.fn(async () => true);
const setParameter = vi.fn(async () => true);

let host: HTMLDivElement;
let root: Root;

const MAV_TYPE_GROUND_ROVER = 10;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  for (const fn of [armDisarm, overrideRelease, setMode, setParameter]) fn.mockClear();
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    mavlinkArmDisarm: armDisarm,
    rcOverrideRelease: overrideRelease,
    rcOverrideSetChannels: vi.fn(async () => true),
    rcOverrideSet: vi.fn(async () => true),
    mavlinkSetMode: setMode,
  };
  useConnectionStore.setState((s) => ({ connectionState: { ...s.connectionState, mavType: MAV_TYPE_GROUND_ROVER } }));
  useParameterStore.setState({
    parameters: new Map([['ARMING_CHECK', { value: 1 }]]) as never,
    setParameter: setParameter as never,
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<StickTestPanel />));
});

afterEach(() => {
  vi.useRealTimers();
  host.remove();
});

const startButton = () => [...host.querySelectorAll('button')][0]!;

describe('leaving the stick test tab', () => {
  it('sends nothing to the vehicle when the test was never started', () => {
    act(() => root.unmount());
    expect(armDisarm).not.toHaveBeenCalled();
    expect(overrideRelease).not.toHaveBeenCalled();
    expect(setParameter).not.toHaveBeenCalled();
  });

  it('disarms and restores ARMING_CHECK when the test is running', async () => {
    act(() => startButton().click());
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(armDisarm).toHaveBeenCalledWith(true, true);
    expect(setParameter).toHaveBeenCalledWith('ARMING_CHECK', 0);

    act(() => root.unmount());
    expect(armDisarm).toHaveBeenLastCalledWith(false, true);
    expect(overrideRelease).toHaveBeenCalled();
    expect(setParameter).toHaveBeenLastCalledWith('ARMING_CHECK', 1);
  });

  it('puts ARMING_CHECK back and does not disarm when the vehicle refuses MANUAL', async () => {
    setMode.mockResolvedValueOnce(false);
    act(() => startButton().click());
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(setParameter).toHaveBeenLastCalledWith('ARMING_CHECK', 1);

    act(() => root.unmount());
    expect(armDisarm).not.toHaveBeenCalled();
  });
});
