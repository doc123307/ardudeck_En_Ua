import { t } from '../../i18n';
/** Last few hub WebRTC connections, failed ones included, for the renderer half of "Copy diagnostics". */

const KEEP = 6;
const SNAPSHOT_MS = 1000;
const SNAPSHOT_FOR_MS = 15_000;

interface PeerRecord {
  label: string;
  startedAt: Date;
  pc: RTCPeerConnection;
  timeline: string[];
  remoteSdp: string;
  pairs: string;
}

const records: PeerRecord[] = [];

/** "udp 10.0.0.2:5000 host, tcp ..." from the a=candidate lines of an SDP. */
export function candidateSummary(sdp: string): string {
  const out = sdp
    .split(/\r?\n/)
    .filter((l) => l.startsWith('a=candidate:'))
    .map((l) => {
      const f = l.split(' ');
      return `${f[2] ?? '?'} ${f[4] ?? '?'}:${f[5] ?? '?'} ${f[7] ?? '?'}`;
    });
  return out.length ? out.join(', ') : t('camera.webrtc_diag.noCandidates');
}

async function snapshotPairs(rec: PeerRecord): Promise<void> {
  if (rec.pc.connectionState === 'closed') return;
  try {
    const pairs: string[] = [];
    (await rec.pc.getStats()).forEach((s: Record<string, unknown>) => {
      if (s.type === 'candidate-pair') {
        pairs.push(`${String(s.state)} sent=${String(s.requestsSent ?? '?')} answered=${String(s.responsesReceived ?? '?')}`);
      }
    });
    rec.pairs = pairs.join('; ') || 'none';
  } catch {
    /* closed between the check and the call */
  }
}

/** Register a connection; call the returned function with the answer SDP once it arrives. */
export function trackPeer(label: string, pc: RTCPeerConnection): (remoteSdp: string) => void {
  const t0 = performance.now();
  const rec: PeerRecord = { label, startedAt: new Date(), pc, timeline: [], remoteSdp: '', pairs: 'none' };
  records.push(rec);
  if (records.length > KEEP) records.shift();

  const mark = (what: string) => {
    rec.timeline.push(`${what}@${Math.round(performance.now() - t0)}ms`);
    void snapshotPairs(rec);
  };
  pc.addEventListener('iceconnectionstatechange', () => mark(`ice:${pc.iceConnectionState}`));
  pc.addEventListener('connectionstatechange', () => mark(`conn:${pc.connectionState}`));

  // Pair counters stop being readable once the connection is closed, so keep sampling early
  // on, and stop at once for an attempt that closed (a dropout makes many of those).
  const timer = setInterval(() => {
    if (pc.connectionState === 'closed') clearInterval(timer);
    else void snapshotPairs(rec);
  }, SNAPSHOT_MS);
  setTimeout(() => clearInterval(timer), SNAPSHOT_FOR_MS);

  return (remoteSdp: string) => { rec.remoteSdp = remoteSdp; };
}

export async function describePeers(): Promise<string> {
  if (!records.length) return t('camera.webrtc_diag.noWebrtcConnectionsThisSession');
  const lines: string[] = [];
  for (const rec of records) {
    await snapshotPairs(rec);
    lines.push(`${rec.label} (started ${rec.startedAt.toISOString()}, now ${rec.pc.connectionState})`);
    lines.push(`  timeline ${rec.timeline.join(' ') || 'none'}`);
    lines.push(`  local ${candidateSummary(rec.pc.localDescription?.sdp ?? '')}`);
    lines.push(`  remote ${candidateSummary(rec.remoteSdp)}`);
    lines.push(`  pairs ${rec.pairs}`);
  }
  return lines.join('\n');
}
