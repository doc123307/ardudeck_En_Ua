// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HoldButton } from './HoldButton';

const onConfirm = vi.fn();
let host: HTMLDivElement;
let root: Root;

const button = () => host.querySelector('button')!;
const pointer = (type: string) => act(() => { button().dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 })); });

function mount(disabled = false) {
  act(() => root.render(<HoldButton onConfirm={onConfirm} holdMs={1500} disabled={disabled}>ARM</HoldButton>));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  onConfirm.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  mount();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('HoldButton', () => {
  it('does nothing on a click or a short press', () => {
    pointer('pointerdown');
    act(() => { vi.advanceTimersByTime(600); });
    pointer('pointerup');
    act(() => { button().click(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('acts once the press has been held for the full time', () => {
    pointer('pointerdown');
    act(() => { vi.advanceTimersByTime(1499); });
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('is cancelled when the pointer slides off or the window loses focus', () => {
    pointer('pointerdown');
    act(() => { vi.advanceTimersByTime(1000); });
    // React builds pointerleave from pointerout: that is the event a real pointer sliding off produces.
    act(() => { button().dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body })); });
    act(() => { vi.advanceTimersByTime(2000); });

    pointer('pointerdown');
    act(() => { vi.advanceTimersByTime(1000); window.dispatchEvent(new Event('blur')); });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cannot be held while disabled', () => {
    mount(true);
    pointer('pointerdown');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
