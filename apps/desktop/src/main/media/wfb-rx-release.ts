export const WFB_RX_TAG = 'wfb-rx-v0.1.0';
const RELEASE_BASE = 'https://github.com/rubenCodeforges/ardudeck/releases/download';

// Must match the matrix in .github/workflows/build-wfb-rx.yml.
const PUBLISHED: Record<string, readonly string[]> = {
  darwin: ['arm64', 'x64'],
  linux: ['x64'],
  win32: ['x64'],
};

const PLATFORM_LABEL: Record<string, string> = { darwin: 'macOS', linux: 'Linux', win32: 'Windows' };

const NETWORK_MODE_FALLBACK =
  'Until then, set the feed to Network mode and run the receiver on another machine that forwards video here.';

export class HttpStatusError extends Error {
  constructor(readonly status: number, readonly url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpStatusError';
  }
}

/** Same arch folding as the other media downloads: anything not arm64 is x64. */
function archToken(arch: string): 'arm64' | 'x64' {
  return arch === 'arm64' ? 'arm64' : 'x64';
}

export function wfbRxAssetName(platform: string, arch: string): string {
  return `ardudeck-wfb-rx-${platform}-${archToken(arch)}${platform === 'win32' ? '.exe' : ''}`;
}

export function wfbRxAssetUrl(platform: string, arch: string): string {
  return `${RELEASE_BASE}/${WFB_RX_TAG}/${wfbRxAssetName(platform, arch)}`;
}

export function isWfbRxBuiltFor(platform: string, arch: string): boolean {
  return PUBLISHED[platform]?.includes(archToken(arch)) ?? false;
}

function platformLabel(platform: string, arch: string): string {
  return `${PLATFORM_LABEL[platform] ?? platform} (${archToken(arch)})`;
}

export function wfbRxNotBuiltMessage(platform: string, arch: string): string {
  return `The wfb-ng receiver is not built for ${platformLabel(platform, arch)}, so dongle mode cannot run on this computer. Set the feed to Network mode and run the receiver on another machine that forwards video here.`;
}

/** Stream start without the receiver on disk: say whether Install can fix it. */
export function wfbRxMissingMessage(platform: string, arch: string): string {
  if (!isWfbRxBuiltFor(platform, arch)) return wfbRxNotBuiltMessage(platform, arch);
  return `The wfb-ng receiver component (${wfbRxAssetName(platform, arch)}) is not installed. Open the feed setup and press Install next to "Receiver component missing".`;
}

/** Turn a failed receiver download into a sentence naming what is missing. */
export function describeWfbRxDownloadError(err: unknown, platform: string, arch: string): string {
  const asset = wfbRxAssetName(platform, arch);
  if (err instanceof HttpStatusError && err.status === 404) {
    return `The wfb-ng receiver for ${platformLabel(platform, arch)} has not been published yet (release ${WFB_RX_TAG} has no ${asset}), so dongle mode cannot start. ${NETWORK_MODE_FALLBACK}`;
  }
  const reason = err instanceof HttpStatusError ? `HTTP ${err.status}` : err instanceof Error ? err.message : 'download failed';
  return `Could not download the wfb-ng receiver (${asset}): ${reason}. Check the internet connection and try Install again.`;
}
