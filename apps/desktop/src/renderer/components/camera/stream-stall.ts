// Stall = frame ARRIVAL stops; readyState is useless (stays HAVE_ENOUGH_DATA on a frozen track).

/** No new frame for this long after at least one frame arrived = stalled. */
export const STALL_AFTER_MS = 3000;

/** A started feed that shows no frame at all within this time has failed, even if the connection says otherwise. */
export const FIRST_FRAME_TIMEOUT_MS = 12000;

interface StallTracker {
  onFrame: (nowMs: number) => void;
  isStalled: (nowMs: number) => boolean;
  hasFrames: () => boolean;
}

export function createStallTracker(stallMs: number = STALL_AFTER_MS): StallTracker {
  let lastFrameMs: number | null = null;
  return {
    onFrame: (nowMs) => {
      lastFrameMs = nowMs;
    },
    isStalled: (nowMs) => lastFrameMs !== null && nowMs - lastFrameMs >= stallMs,
    hasFrames: () => lastFrameMs !== null,
  };
}

/** A dropped link reconnects its playback at this steady pace: recovery must follow the signal, not a backoff. */
export const RECONNECT_MS = 1000;

/** Every this many failed reconnects, re-check the hub session itself in case it went away. */
export const RECHECK_SESSION_EVERY = 10;

// Retries never give up: a dongle replugged minutes later must recover hands-off.
export function nextRetryDelayMs(attempt: number): number {
  const table = [1000, 2000, 4000, 8000];
  return table[Math.min(attempt, table.length - 1)] ?? 8000;
}
