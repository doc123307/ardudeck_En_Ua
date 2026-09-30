/**
 * Link Doctor stream classifier.
 *
 * When a connection attempt gets no heartbeat, the raw bytes on the wire
 * almost always say why. Instead of a bare "connection timeout", sample the
 * stream and tell the user what the port is actually speaking and what to do
 * about it - e.g. an ELRS TX module still in Normal (CRSF) link mode, a GPS
 * on the wrong port, a debug console, or a baud mismatch.
 */

import { extractCrsfFrames, CRSF_FRAMETYPE_LINK_STATISTICS } from './crsf-protocol.js';
import type { StreamDiagnosis } from '../../shared/link-doctor-types.js';

export type { StreamDiagnosis, StreamProtocol } from '../../shared/link-doctor-types.js';

/** Count MAVLink frames by chaining: a frame "validates" when hopping its declared length lands on another start byte or the buffer end. */
function countMavlinkFrames(sample: Uint8Array, stx: number, headerLen: number, overhead: number): number {
  let count = 0;
  let i = 0;
  while (i < sample.length) {
    if (sample[i] !== stx) {
      i++;
      continue;
    }
    if (i + headerLen > sample.length) break;
    const payloadLen = sample[i + 1]!;
    // v2 signed frames add 13 bytes; accept either hop target
    const hops = stx === 0xfd ? [i + overhead + payloadLen, i + overhead + payloadLen + 13] : [i + overhead + payloadLen];
    const hop = hops.find((h) => h >= sample.length - 1 || sample[h] === 0xfd || sample[h] === 0xfe);
    if (hop !== undefined) {
      count++;
      i = Math.min(hop, sample.length);
    } else {
      i++;
    }
  }
  return count;
}

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

export function classifyStream(sample: Uint8Array): StreamDiagnosis {
  const bytes = sample.length;
  const { frames: crsf } = extractCrsfFrames(sample);
  const crsfLinkStats = crsf.filter((f) => f.type === CRSF_FRAMETYPE_LINK_STATISTICS).length;
  const mavlink2Frames = countMavlinkFrames(sample, 0xfd, 10, 12);
  const mavlink1Frames = countMavlinkFrames(sample, 0xfe, 6, 8);

  let printable = 0;
  for (const b of sample) {
    if ((b >= 32 && b < 127) || b === 10 || b === 13 || b === 9) printable++;
  }
  const printableRatio = bytes ? printable / bytes : 0;
  const text = new TextDecoder('ascii', { fatal: false }).decode(sample);
  const nmeaSentences = countMatches(text, /\$G[PNLAB][A-Z]{3},/g);
  const mspFrames = countMatches(text, /\$[MX][<>!]/g);
  let ubxFrames = 0;
  for (let i = 0; i + 1 < sample.length; i++) {
    if (sample[i] === 0xb5 && sample[i + 1] === 0x62) ubxFrames++;
  }

  const counts = {
    bytes,
    mavlink2Frames,
    mavlink1Frames,
    crsfFrames: crsf.length,
    crsfLinkStats,
    mspFrames,
    nmeaSentences,
    ubxFrames,
    printableRatio,
  };

  const base = { counts, elrsNormalMode: false };

  if (bytes === 0) {
    return {
      ...base,
      protocol: 'silence',
      confidence: 'high',
      summary: 'The port is completely silent - no data at all.',
      suggestion:
        'Check power and wiring. If this is a radio module, make sure it is powered and linked; if it is a flight controller, make sure this is the right port.',
    };
  }

  // CRSF wins when it has CRC-validated frames and MAVLink does not dominate.
  if (crsf.length >= 3 && crsf.length >= mavlink2Frames) {
    const elrsNormalMode = crsfLinkStats >= 2;
    return {
      ...base,
      elrsNormalMode,
      protocol: 'crsf',
      confidence: 'high',
      summary: elrsNormalMode
        ? 'This device is speaking CRSF link statistics - it is an ELRS radio module in Normal link mode, not MAVLink.'
        : 'This port is speaking CRSF (RC receiver protocol), not MAVLink.',
      suggestion: elrsNormalMode
        ? 'Switch the module to MAVLink link mode. STOHID can do this for you from the ELRS Radio Setup card - the receiver must be powered off while the mode changes.'
        : 'This looks like an RC receiver feed. To use it for telemetry, the ELRS link must be in MAVLink mode on both ends.',
    };
  }

  if (mavlink2Frames + mavlink1Frames >= 3) {
    return {
      ...base,
      protocol: mavlink2Frames >= mavlink1Frames ? 'mavlink2' : 'mavlink1',
      confidence: 'high',
      summary: 'MAVLink telemetry is flowing on this port, but no vehicle heartbeat was accepted.',
      suggestion:
        'The stream may be from a radio or companion device rather than the flight controller, or heavily corrupted. Check that the vehicle is powered and its telemetry port is configured for MAVLink2.',
    };
  }

  if (nmeaSentences >= 2 || ubxFrames >= 3) {
    return {
      ...base,
      protocol: nmeaSentences >= 2 ? 'nmea' : 'ublox',
      confidence: 'high',
      summary: 'This is a GPS module (NMEA/u-blox output), not a flight controller.',
      suggestion: 'Pick a different serial port - this one has a GPS on it.',
    };
  }

  if (mspFrames >= 2) {
    return {
      ...base,
      protocol: 'msp',
      confidence: 'medium',
      summary: 'This port is speaking MSP (Betaflight/iNav protocol), not MAVLink.',
      suggestion: 'Connect with the MSP option instead, or switch the flight controller port to MAVLink.',
    };
  }

  if (printableRatio > 0.85) {
    return {
      ...base,
      protocol: 'ascii-log',
      confidence: 'medium',
      summary: 'This port is printing text (a debug console), not telemetry.',
      suggestion: 'The device is in a logging/boot mode or this is its debug output port. Check its mode and pick the telemetry port.',
    };
  }

  return {
    ...base,
    protocol: 'unknown',
    confidence: 'low',
    summary: 'Data is arriving but it does not match any known protocol.',
    suggestion:
      'This usually means the baud rate is wrong. Try other baud rates (ELRS MAVLink uses 460800, SiK radios 57600, flight controller USB 115200).',
  };
}

/**
 * Classify a UDP capture where datagram boundaries are known. Video streams
 * (RTP, MPEG-TS) are only recognisable per-datagram - an RTP header is two
 * version bits and a payload type, meaningless once packets are concatenated.
 * Falls back to the byte-stream classifier for everything else.
 */
export function classifyDatagrams(datagrams: Uint8Array[]): StreamDiagnosis {
  const n = datagrams.length;
  if (n >= 3) {
    let rtp = 0;
    let ts = 0;
    const payloadTypes = new Set<number>();
    for (const d of datagrams) {
      if (d.length >= 12 && (d[0]! & 0xc0) === 0x80) {
        rtp++;
        payloadTypes.add(d[1]! & 0x7f);
      }
      if (d.length >= 188 && d[0] === 0x47 && d.length % 188 === 0) ts++;
    }
    const bytes = datagrams.reduce((s, d) => s + d.length, 0);
    if (ts > n * 0.8) {
      return {
        protocol: 'mpegts',
        confidence: 'high',
        summary: 'An MPEG-TS video stream is arriving on this port.',
        suggestion: 'Use the RTP/UDP camera source - the media engine ingests MPEG-TS directly.',
        elrsNormalMode: false,
        counts: { bytes, mavlink2Frames: 0, mavlink1Frames: 0, crsfFrames: 0, crsfLinkStats: 0, mspFrames: 0, nmeaSentences: 0, ubxFrames: 0, printableRatio: 0 },
      };
    }
    if (rtp > n * 0.8) {
      const pts = [...payloadTypes].sort((a, b) => a - b).join(',');
      return {
        protocol: 'rtp',
        confidence: 'high',
        summary: `An RTP video stream is arriving on this port (payload type ${pts}).`,
        suggestion: 'The wfb-ng ground station is forwarding video - the OpenIPC/WiFiLink camera source can play it.',
        elrsNormalMode: false,
        counts: { bytes, mavlink2Frames: 0, mavlink1Frames: 0, crsfFrames: 0, crsfLinkStats: 0, mspFrames: 0, nmeaSentences: 0, ubxFrames: 0, printableRatio: 0 },
      };
    }
  }
  const total = datagrams.reduce((s, d) => s + d.length, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const d of datagrams) {
    merged.set(d, off);
    off += d.length;
  }
  return classifyStream(merged);
}
