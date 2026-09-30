/**
 * wfb-ng dongle detection + receiver process contract. Pure helpers
 * (parsers/builders) so they are unit-testable; process/exec plumbing lives
 * in wfbng-receiver.ts.
 *
 * The dongle: every OpenIPC/WiFiLink ground kit ships an RTL8812AU-family
 * adapter (Realtek "Jaguar" 11ac). No desktop OS has a useful driver for it,
 * which is exactly what makes the userspace path work - the device sits
 * unclaimed on USB and a libusb-based receiver can drive it directly
 * (OpenIPC's `devourer` driver, proven by Aviateur/fpv4win/PixelPilot).
 *
 * Receiver binary contract (`ardudeck-wfb-rx`, bundled like ffmpeg/mediamtx):
 *   ardudeck-wfb-rx --key <gs.key> --channel <n> --bandwidth <20|40> \
 *                   --output udp://127.0.0.1:<port>
 * It claims the first supported dongle over libusb, tunes the channel,
 * decrypts/FEC-decodes the wfb-ng video stream and emits it as RTP on the
 * output port - where the existing wfbng ffmpeg ingest picks it up.
 */

/** Realtek "Jaguar" (RTL8812AU family) USB product IDs the userspace driver supports. */
export const WFB_DONGLE_VENDOR = 0x0bda;
export const WFB_DONGLE_PRODUCTS = new Set([0x8812, 0x881a, 0x0811, 0x8811, 0x0821, 0x8814]);

export interface DetectedDongle {
  vendorId: number;
  productId: number;
  name: string;
}

function idsMatch(vendorId: number, productId: number): boolean {
  return vendorId === WFB_DONGLE_VENDOR && WFB_DONGLE_PRODUCTS.has(productId);
}

/** Parse `system_profiler -json SPUSBDataType` output (macOS). */
export function findDongleMac(json: string): DetectedDongle | null {
  try {
    const root = JSON.parse(json) as { SPUSBDataType?: unknown[] };
    const walk = (items: unknown[]): DetectedDongle | null => {
      for (const item of items) {
        const o = item as Record<string, unknown>;
        const vid = parseInt(String(o.vendor_id ?? ''), 16);
        const pid = parseInt(String(o.product_id ?? ''), 16);
        if (idsMatch(vid, pid)) {
          return { vendorId: vid, productId: pid, name: String(o._name ?? 'RTL8812AU') };
        }
        if (Array.isArray(o._items)) {
          const nested = walk(o._items);
          if (nested) return nested;
        }
      }
      return null;
    };
    return walk(root.SPUSBDataType ?? []);
  } catch {
    return null;
  }
}

/**
 * Parse `ioreg -p IOUSB -l -w 0` output (macOS fallback).
 *
 * `system_profiler SPUSBDataType` returns an EMPTY document on some macOS
 * builds while exiting 0, so detection through it silently finds nothing and
 * the app tells the pilot to plug in a dongle that is already plugged in.
 * ioreg reads the same registry without that failure mode.
 *
 * Entries look like:
 *   "USB Product Name" = "802.11n NIC"
 *   "idProduct" = 34834
 *   "idVendor" = 3034
 * with the numbers in DECIMAL, unlike every other source here.
 */
export function findDongleIoreg(ioreg: string): DetectedDongle | null {
  const lines = ioreg.split('\n');
  let vendorId: number | null = null;
  let productId: number | null = null;
  let name = 'RTL8812AU';

  for (const line of lines) {
    const nameMatch = /"USB Product Name"\s*=\s*"([^"]*)"/.exec(line);
    if (nameMatch) name = nameMatch[1] ?? name;

    const vendorMatch = /"idVendor"\s*=\s*(\d+)/.exec(line);
    if (vendorMatch) vendorId = Number(vendorMatch[1]);

    const productMatch = /"idProduct"\s*=\s*(\d+)/.exec(line);
    if (productMatch) productId = Number(productMatch[1]);

    // ioreg prints one device's properties as a block, but not in a fixed
    // order, so a pair is only trusted once both halves are known.
    if (vendorId !== null && productId !== null) {
      if (idsMatch(vendorId, productId)) {
        return { vendorId, productId, name };
      }
      vendorId = null;
      productId = null;
      name = 'RTL8812AU';
    }
  }
  return null;
}

/** Parse `lsusb` output (Linux): "Bus 001 Device 004: ID 0bda:8812 Realtek ...". */
export function findDongleLinux(lsusb: string): DetectedDongle | null {
  for (const line of lsusb.split('\n')) {
    const m = line.match(/ID\s+([0-9a-f]{4}):([0-9a-f]{4})\s*(.*)/i);
    if (!m) continue;
    const vid = parseInt(m[1]!, 16);
    const pid = parseInt(m[2]!, 16);
    if (idsMatch(vid, pid)) return { vendorId: vid, productId: pid, name: m[3]?.trim() || 'RTL8812AU' };
  }
  return null;
}

/** Parse Windows PowerShell PnP output containing InstanceId lines with VID_/PID_. */
export function findDongleWindows(pnp: string): DetectedDongle | null {
  const m = pnp.match(/VID_([0-9A-F]{4})&PID_([0-9A-F]{4})/i);
  if (!m) return null;
  const vid = parseInt(m[1]!, 16);
  const pid = parseInt(m[2]!, 16);
  return idsMatch(vid, pid) ? { vendorId: vid, productId: pid, name: 'RTL8812AU' } : null;
}

/** Windows binds Realtek's own driver to the dongle, and libusb cannot open it until WinUSB replaces it. */
export const WINDOWS_WINUSB_NOTE =
  'On Windows the dongle needs the WinUSB driver: run Zadig (zadig.akeo.ie), choose Options > List All Devices, select the Realtek 8812AU adapter, install WinUSB, then replug the dongle.';

export function receiverDriverNote(platform: string): string | null {
  return platform === 'win32' ? WINDOWS_WINUSB_NOTE : null;
}

/** Receiver log lines meaning the adapter is there but could not be claimed. */
export function isDongleOpenFailure(message: string): boolean {
  return /Cannot open device|Failed to claim interface|LIBUSB_ERROR_(NOT_SUPPORTED|ACCESS)/i.test(message);
}

export interface WfbReceiverOptions {
  gsKeyPath: string;
  channel: number;
  bandwidth: 20 | 40;
  outputPort: number;
}

export function buildReceiverArgs(o: WfbReceiverOptions): string[] {
  return [
    '--key', o.gsKeyPath,
    '--channel', String(o.channel),
    '--bandwidth', String(o.bandwidth),
    '--output', `udp://127.0.0.1:${o.outputPort}`,
  ];
}

/** 5.8 GHz channels commonly used by OpenIPC/WiFiLink (default 161). */
export const WFB_CHANNELS = [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149, 153, 157, 161, 165, 169, 173, 177];
export const WFB_DEFAULT_CHANNEL = 161;
