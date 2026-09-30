import { describe, it, expect } from 'vitest';
import {
  HttpStatusError,
  WFB_RX_TAG,
  describeWfbRxDownloadError,
  isWfbRxBuiltFor,
  wfbRxAssetName,
  wfbRxAssetUrl,
  wfbRxMissingMessage,
} from './wfb-rx-release.js';

describe('wfb-rx release assets', () => {
  it('names assets exactly as build-wfb-rx.yml publishes them', () => {
    expect(wfbRxAssetName('win32', 'x64')).toBe('ardudeck-wfb-rx-win32-x64.exe');
    expect(wfbRxAssetName('darwin', 'arm64')).toBe('ardudeck-wfb-rx-darwin-arm64');
    expect(wfbRxAssetName('darwin', 'x64')).toBe('ardudeck-wfb-rx-darwin-x64');
    expect(wfbRxAssetName('linux', 'x64')).toBe('ardudeck-wfb-rx-linux-x64');
    expect(wfbRxAssetName('win32', 'ia32')).toBe('ardudeck-wfb-rx-win32-x64.exe');
  });

  it('points at the pinned release tag', () => {
    expect(wfbRxAssetUrl('win32', 'x64')).toBe(
      `https://github.com/rubenCodeforges/ardudeck/releases/download/${WFB_RX_TAG}/ardudeck-wfb-rx-win32-x64.exe`,
    );
  });

  it('knows which platforms the workflow builds', () => {
    expect(isWfbRxBuiltFor('win32', 'x64')).toBe(true);
    expect(isWfbRxBuiltFor('darwin', 'arm64')).toBe(true);
    expect(isWfbRxBuiltFor('linux', 'x64')).toBe(true);
    expect(isWfbRxBuiltFor('win32', 'arm64')).toBe(false);
    expect(isWfbRxBuiltFor('linux', 'arm64')).toBe(false);
    expect(isWfbRxBuiltFor('freebsd', 'x64')).toBe(false);
  });
});

describe('wfb-rx failure messages', () => {
  it('turns a 404 into "not published yet" naming the release and asset, not a raw HTTP error', () => {
    const msg = describeWfbRxDownloadError(new HttpStatusError(404, wfbRxAssetUrl('win32', 'x64')), 'win32', 'x64');
    expect(msg).toContain('Windows (x64)');
    expect(msg).toContain('not been published');
    expect(msg).toContain(WFB_RX_TAG);
    expect(msg).toContain('ardudeck-wfb-rx-win32-x64.exe');
    expect(msg).toContain('Network mode');
    expect(msg).not.toContain('HTTP 404');
  });

  it('keeps other HTTP and network failures distinct from "not published"', () => {
    const http = describeWfbRxDownloadError(new HttpStatusError(503, 'u'), 'darwin', 'arm64');
    expect(http).toContain('HTTP 503');
    expect(http).not.toContain('not been published');
    const net = describeWfbRxDownloadError(new Error('getaddrinfo ENOTFOUND github.com'), 'linux', 'x64');
    expect(net).toContain('ENOTFOUND');
    expect(net).toContain('ardudeck-wfb-rx-linux-x64');
  });

  it('on stream start, points to Install when a build exists and to Network mode when none does', () => {
    expect(wfbRxMissingMessage('win32', 'x64')).toContain('press Install');
    const arm = wfbRxMissingMessage('win32', 'arm64');
    expect(arm).toContain('not built for Windows (arm64)');
    expect(arm).toContain('Network mode');
  });
});
