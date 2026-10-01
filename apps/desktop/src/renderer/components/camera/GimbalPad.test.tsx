// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GimbalPad } from './GimbalPad';

const cameraCommand = vi.fn(async () => true);

let host: HTMLDivElement;
let root: Root;

function zoomButton(label: string): HTMLButtonElement {
  const btn = [...host.querySelectorAll('button')].find((b) => b.textContent === label);
  if (!btn) throw new Error(`no ${label} button`);
  return btn;
}

function pointer(el: Element, type: string) {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
}

const zoomValues = () => cameraCommand.mock.calls.map((c) => (c as unknown as [string, { value: number }])[1].value);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  cameraCommand.mockClear();
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    cameraCameraCommand: cameraCommand,
    cameraGimbalCommand: vi.fn(async () => true),
  };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<GimbalPad vehicleKey="v1" />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('zoom buttons', () => {
  it('a click zooms while pressed and stops on release, never the other way round', () => {
    const btn = zoomButton('Zoom +');
    act(() => {
      pointer(btn, 'pointerdown');
      pointer(btn, 'pointerup');
      btn.click();
    });
    expect(zoomValues()).toEqual([1, 0]);
  });

  it('stops when the window loses focus mid-hold', () => {
    act(() => pointer(zoomButton('Zoom −'), 'pointerdown'));
    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(zoomValues()).toEqual([-1, 0]);
  });

  it('stops when the panel closes mid-hold', () => {
    act(() => pointer(zoomButton('Zoom +'), 'pointerdown'));
    act(() => root.unmount());
    expect(zoomValues()).toEqual([1, 0]);
    root = createRoot(host);
  });
});
