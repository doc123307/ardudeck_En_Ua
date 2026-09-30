// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useGuidesStore } from './guides-store';
import { APP_GUIDES } from '../guides/registry';

const store = () => useGuidesStore.getState();

describe('guides store', () => {
  beforeEach(() => {
    localStorage.clear();
    useGuidesStore.setState({ queue: [], runLength: 0 });
  });

  it('uses the same storage keys as the mobile app', () => {
    store().markSeen('grouping-v1');
    store().setSuppressed(true);
    expect(localStorage.getItem('guide-seen:grouping-v1')).toBe('true');
    expect(localStorage.getItem('guides-auto-show-suppressed')).toBe('true');
  });

  it('walks a run guide by guide and marks each one seen', () => {
    store().start(['a', 'b']);
    expect(store().runLength).toBe(2);
    store().finishCurrent(true);
    expect(store().queue).toEqual(['b']);
    expect(store().isSeen('a')).toBe(true);
    store().finishCurrent(true);
    expect(store().queue).toEqual([]);
    expect(store().isSeen('b')).toBe(true);
  });

  it('Skip ends the whole run but only marks the guide on screen', () => {
    store().start(['a', 'b', 'c']);
    store().finishCurrent(false);
    expect(store().queue).toEqual([]);
    expect(store().runLength).toBe(0);
    expect(store().isSeen('b')).toBe(false);
  });

  it('reset brings guides and auto-show back', () => {
    store().markSeen('a');
    store().setSuppressed(true);
    store().resetSeen(['a']);
    expect(store().isSeen('a')).toBe(false);
    expect(store().isSuppressed()).toBe(false);
  });

  it('guide ids are unique and versioned', () => {
    const ids = APP_GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/-v\d+$/);
  });
});
