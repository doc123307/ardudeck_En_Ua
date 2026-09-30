import { describe, it, expect } from 'vitest';
import {
  findDongleMac,
  findDongleIoreg,
  findDongleLinux,
  findDongleWindows,
  buildReceiverArgs,
  isDongleOpenFailure,
  receiverDriverNote,
} from './wfbng-dongle.js';

describe('wfb-ng dongle detection parsers', () => {
  it('finds the RTL8812AU in system_profiler JSON (real capture shape)', () => {
    const json = JSON.stringify({
      SPUSBDataType: [
        {
          _name: 'USB 3.1 Bus',
          _items: [
            { _name: 'Some Hub', vendor_id: '0x05ac', product_id: '0x1234' },
            { _name: '802.11n NIC', vendor_id: '0x0bda', product_id: '0x8812' },
          ],
        },
      ],
    });
    const d = findDongleMac(json)!;
    expect(d).toMatchObject({ vendorId: 0x0bda, productId: 0x8812, name: '802.11n NIC' });
  });

  it('returns null when no supported dongle is present (mac)', () => {
    const json = JSON.stringify({ SPUSBDataType: [{ _name: 'Bus', _items: [{ vendor_id: '0x10c4', product_id: '0xea60' }] }] });
    expect(findDongleMac(json)).toBeNull();
    expect(findDongleMac('not json')).toBeNull();
  });

  it('finds the dongle in lsusb output', () => {
    const out = [
      'Bus 001 Device 002: ID 8087:0024 Intel Corp. Integrated Rate Matching Hub',
      'Bus 002 Device 004: ID 0bda:8812 Realtek Semiconductor Corp. RTL8812AU 802.11a/b/g/n/ac',
    ].join('\n');
    const d = findDongleLinux(out)!;
    expect(d.productId).toBe(0x8812);
    expect(d.name).toContain('RTL8812AU');
    expect(findDongleLinux('Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub')).toBeNull();
  });

  it('finds the dongle in Windows PnP instance ids', () => {
    expect(findDongleWindows('USB\\VID_0BDA&PID_8812\\123456')?.productId).toBe(0x8812);
    expect(findDongleWindows('USB\\VID_0BDA&PID_881A\\1')?.productId).toBe(0x881a);
    expect(findDongleWindows('USB\\VID_10C4&PID_EA60\\0001')).toBeNull();
  });

  it('builds the receiver contract args', () => {
    const args = buildReceiverArgs({ gsKeyPath: '/keys/gs.key', channel: 161, bandwidth: 20, outputPort: 5600 });
    expect(args).toEqual(['--key', '/keys/gs.key', '--channel', '161', '--bandwidth', '20', '--output', 'udp://127.0.0.1:5600']);
  });
});

describe('findDongleIoreg', () => {
  it('finds the RTL8812AU in ioreg output when system_profiler comes back empty', () => {
    // Real capture from a Mac where `system_profiler SPUSBDataType` printed
    // nothing at all and exited 0, so the app told the pilot to plug in a
    // dongle that was already plugged in. ioreg reports ids in decimal:
    // 3034 = 0x0bda, 34834 = 0x8812.
    const ioreg = `
  | | |   "USB Product Name" = "USB2.0 Hub"
  | | |   "idVendor" = 8457
  | | |   "idProduct" = 10263
  | |       "USB Product Name" = "802.11n NIC"
  | |       "idProduct" = 34834
  | |       "idVendor" = 3034
  |         "USB Product Name" = "USB 10_100_1000 LAN"
  |         "idVendor" = 3034
  |         "idProduct" = 33107
`;
    expect(findDongleIoreg(ioreg)).toEqual({
      vendorId: 0x0bda,
      productId: 0x8812,
      name: '802.11n NIC',
    });
  });

  it('ignores other Realtek devices on the same bus', () => {
    // The kit's ethernet adapter is also 0x0bda and sits next to it.
    const ioreg = `
  |         "USB Product Name" = "USB 10_100_1000 LAN"
  |         "idVendor" = 3034
  |         "idProduct" = 33107
`;
    expect(findDongleIoreg(ioreg)).toBeNull();
  });
});

describe('receiver driver hints', () => {
  it('only Windows needs a driver step, and it names Zadig and WinUSB', () => {
    expect(receiverDriverNote('win32')).toMatch(/Zadig.*WinUSB/);
    expect(receiverDriverNote('darwin')).toBeNull();
    expect(receiverDriverNote('linux')).toBeNull();
  });

  it('recognises the receiver lines for an adapter the OS driver still owns', () => {
    expect(isDongleOpenFailure('Cannot open device 0bda:8812 at [1:3]')).toBe(true);
    expect(isDongleOpenFailure('Failed to claim interface')).toBe(true);
    expect(isDongleOpenFailure('libusb: error [winusb_open] LIBUSB_ERROR_NOT_SUPPORTED')).toBe(true);
    expect(isDongleOpenFailure('RTP stream live: codec=H265')).toBe(false);
  });
});
