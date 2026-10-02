import { describe, it, expect } from 'vitest';
import { feedsFor, mainFeed, recordTargets, recordingWanted } from './useOperatorFeeds';
import { rearCamera } from './useOperatorRc';
import type { CameraSourceConfig } from '../../../shared/camera-types';

const cam = (id: string, label: string, vehicleKey = 'v1'): CameraSourceConfig => ({ id, label, vehicleKey, kind: 'rtsp', url: `rtsp://x/${id}` });
const front = cam('f', 'Передня камера');
const rear = cam('r', 'Задня камера');

describe('what is recorded', () => {
  it('every camera, or the main one alone', () => {
    expect(recordTargets([front, rear], front, true)).toEqual([front, rear]);
    expect(recordTargets([front, rear], rear, false)).toEqual([rear]);
    expect(recordTargets([], null, false)).toEqual([]);
  });

  it('always: whatever the vehicle and the button say', () => {
    expect(recordingWanted('always', { armed: false, buttonOn: false })).toBe(true);
  });

  it('while armed: follows the vehicle, not the button', () => {
    expect(recordingWanted('armed', { armed: false, buttonOn: true })).toBe(false);
    expect(recordingWanted('armed', { armed: true, buttonOn: false })).toBe(true);
  });

  it('by button: follows the button, not the vehicle', () => {
    expect(recordingWanted('manual', { armed: true, buttonOn: false })).toBe(false);
    expect(recordingWanted('manual', { armed: false, buttonOn: true })).toBe(true);
  });
});

describe('the feeds on the operator screen', () => {
  it('are the active vehicle\'s, or all of them when it has none', () => {
    const other = cam('o', 'Other', 'v2');
    expect(feedsFor([front, other], 'v1')).toEqual([front]);
    expect(feedsFor([front, other], 'v9')).toEqual([front, other]);
    expect(feedsFor([front, other], null)).toEqual([front, other]);
  });

  it('show the operator\'s pick full size, else the selected one, else the first', () => {
    expect(mainFeed([front, rear], 'r', 'f')).toBe(rear);
    expect(mainFeed([front, rear], 'gone', 'r')).toBe(rear);
    expect(mainFeed([front, rear], null, undefined)).toBe(front);
    expect(mainFeed([], null, undefined)).toBeNull();
  });
});

describe('the rear camera for reverse driving', () => {
  it('is the administrator\'s choice when there is one', () => {
    expect(rearCamera([front, rear], 'f')).toBe(front);
  });

  it('is otherwise found by its name, in any of the languages people label cameras in', () => {
    expect(rearCamera([front, rear], '')).toBe(rear);
    expect(rearCamera([cam('a', 'Front'), cam('b', 'Rear view')], '')?.id).toBe('b');
    expect(rearCamera([cam('a', 'Cam 1'), cam('b', 'Backup cam')], 'gone')?.id).toBe('b');
  });

  it('is nobody when nothing says which one looks back', () => {
    expect(rearCamera([cam('a', 'Cam 1'), cam('b', 'Cam 2')], '')).toBeNull();
  });
});
