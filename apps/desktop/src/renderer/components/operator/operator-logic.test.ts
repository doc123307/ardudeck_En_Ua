import { describe, it, expect } from 'vitest';
import {
  connectOptionsFromMemory, describeConnection, fixKind, formatDuration, holdProgress, isRoverLike, tiltLevel,
} from './operator-logic';

describe('tiltLevel', () => {
  it('warns before the limit and alarms at it, for either side', () => {
    expect(tiltLevel(10, 25, 35)).toBe('ok');
    expect(tiltLevel(-25, 25, 35)).toBe('warn');
    expect(tiltLevel(34.9, 25, 35)).toBe('warn');
    expect(tiltLevel(-35, 25, 35)).toBe('danger');
  });
});

describe('formatDuration', () => {
  it('shows minutes and seconds, and hours only when there are any', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(754_000)).toBe('12:34');
    expect(formatDuration(5_025_000)).toBe('1:23:45');
    expect(formatDuration(-5)).toBe('00:00');
  });
});

describe('fixKind', () => {
  it('maps GPS_FIX_TYPE', () => {
    expect([undefined, 0, 1, 2, 3, 4, 5, 6].map(fixKind)).toEqual(['none', 'none', 'none', '2d', '3d', 'dgps', 'rtk', 'rtk']);
  });
});

describe('isRoverLike', () => {
  it('is true for ground rovers and boats only', () => {
    expect([10, 11].map(isRoverLike)).toEqual([true, true]);
    expect([undefined, 1, 2, 13].map(isRoverLike)).toEqual([false, false, false, false]);
  });
});

describe('connectOptionsFromMemory', () => {
  it('rebuilds the UDP client link the panel used last', () => {
    const options = connectOptionsFromMemory({
      lastConnectionType: 'udp', lastUdpMode: 'client', lastUdpPort: 14550,
      lastUdpRemoteHost: '10.0.0.5', lastUdpRemotePort: 14550, lastUdpClientLocalPort: 14551, lastUdpProtocol: 'mavlink',
    });
    expect(options).toEqual({
      type: 'udp', udpMode: 'client', udpPort: 14550, udpRemoteHost: '10.0.0.5', udpRemotePort: 14550,
      udpClientLocalPort: 14551, protocol: 'mavlink',
    });
    expect(describeConnection(options)).toBe('UDP 10.0.0.5:14550');
  });

  it('rebuilds TCP, UDP listen and serial links', () => {
    expect(describeConnection(connectOptionsFromMemory({ lastConnectionType: 'tcp', lastTcpHost: '127.0.0.1', lastTcpPort: 5760 }))).toBe('TCP 127.0.0.1:5760');
    expect(describeConnection(connectOptionsFromMemory({ lastConnectionType: 'udp', lastUdpPort: 14550 }))).toBe('UDP :14550');
    expect(describeConnection(connectOptionsFromMemory({ lastConnectionType: 'serial', lastSerialPort: 'COM5' }))).toBe('COM5 @ 115200');
  });

  it('gives nothing when there is nothing complete to connect to', () => {
    expect(connectOptionsFromMemory(undefined)).toBeNull();
    expect(connectOptionsFromMemory({})).toBeNull();
    expect(connectOptionsFromMemory({ lastConnectionType: 'udp', lastUdpMode: 'client' })).toBeNull();
    expect(connectOptionsFromMemory({ lastConnectionType: 'serial' })).toBeNull();
    expect(describeConnection(null)).toBe('');
  });
});

describe('holdProgress', () => {
  it('runs from 0 to 1 over the hold time', () => {
    expect(holdProgress(null, 1000, 1500)).toBe(0);
    expect(holdProgress(1000, 1750, 1500)).toBe(0.5);
    expect(holdProgress(1000, 9000, 1500)).toBe(1);
  });
});
