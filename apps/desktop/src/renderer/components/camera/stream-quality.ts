/**
 * Main stream (HD) vs sub stream (SD) of an IP camera, read off and written into its
 * RTSP url. The camera serves both all the time; switching is just asking for the
 * other one, so it works on any camera that names its streams in the path.
 *
 *  - Hikvision:  /Streaming/Channels/101 (main), 102 (sub); 201/202 for channel 2
 *  - Hikvision (old firmware): /h264/ch1/main/av_stream, /h264/ch1/sub/av_stream
 *  - Dahua and clones: ?channel=1&subtype=0 (main), subtype=1 (sub)
 *  - Uniview: /media/video1 (main), video2 (sub); or /unicast/c1/s0/live, s1
 *  - Ajax: /<mac>-0_m (main), /<mac>-0_s (sub)
 *  - A relay (mediamtx on the vehicle) that names its paths in pairs:
 *    /frontmain and /frontsub, /rear_main and /rear-sub
 */

export type StreamQuality = 'hd' | 'sd';

const HIK_CHANNEL = /(\/Streaming\/channels\/)(\d+)/i;
const HIK_LEGACY = /(\/ch\d+\/)(main|sub)(\/)/i;
const DAHUA = /([?&]subtype=)(\d)/i;
const UNV_MEDIA = /(\/media\/video)([12])(?=$|[/?#])/i;
const UNV_UNICAST = /(\/unicast\/c\d+\/s)([01])(\/)/i;
// Ends the path: <12 hex digits of the MAC>-<channel>_m or _s
const AJAX = /(\/[0-9a-f]{12}-\d+_)([ms])(?=$|[?#])/i;
// Last path segment ending in main/sub, before any query: rtsp://host:8554/frontsub
const RELAY_PAIR = /^(rtsp:\/\/[^/]+\/(?:[^?#]*\/)?[^/?#]*?)(main|sub)(?=$|[?#])/i;

/** A feed as far as its streams go: the url in use and the pair typed by hand, if any. */
export interface StreamUrls {
  url?: string;
  hdUrl?: string;
  sdUrl?: string;
}

/** The hand-typed pair, when both streams are given and differ. */
function manualPair(source: StreamUrls): { hd: string; sd: string } | null {
  const hd = source.hdUrl?.trim();
  const sd = source.sdUrl?.trim();
  return hd && sd && hd !== sd ? { hd, sd } : null;
}

/** The quality a feed plays: by its hand-typed pair first, by the naming of its url otherwise. */
export function sourceQuality(source: StreamUrls): StreamQuality | null {
  const pair = manualPair(source);
  if (pair) return source.url?.trim() === pair.sd ? 'sd' : 'hd';
  return streamQuality(source.url);
}

/** The url of a feed for `quality`; its own url when there is nothing to switch. */
export function sourceUrlFor(source: StreamUrls, quality: StreamQuality): string | undefined {
  const pair = manualPair(source);
  if (pair) return quality === 'hd' ? pair.hd : pair.sd;
  return source.url ? withStreamQuality(source.url, quality) : source.url;
}

/** The quality the url asks for, or null when the url does not name its stream. */
export function streamQuality(url: string | undefined): StreamQuality | null {
  if (!url) return null;
  const hik = HIK_CHANNEL.exec(url);
  if (hik) {
    const stream = Number(hik[2]) % 100;
    return stream === 1 ? 'hd' : stream === 2 ? 'sd' : null;
  }
  const legacy = HIK_LEGACY.exec(url);
  if (legacy) return legacy[2]!.toLowerCase() === 'main' ? 'hd' : 'sd';
  const dahua = DAHUA.exec(url);
  if (dahua) return dahua[2] === '0' ? 'hd' : dahua[2] === '1' ? 'sd' : null;
  const unv = UNV_MEDIA.exec(url);
  if (unv) return unv[2] === '1' ? 'hd' : 'sd';
  const unicast = UNV_UNICAST.exec(url);
  if (unicast) return unicast[2] === '0' ? 'hd' : 'sd';
  const ajax = AJAX.exec(url);
  if (ajax) return ajax[2]!.toLowerCase() === 'm' ? 'hd' : 'sd';
  const pair = RELAY_PAIR.exec(url);
  if (pair) return pair[2]!.toLowerCase() === 'main' ? 'hd' : 'sd';
  return null;
}

/** The same url asking for `quality`; unchanged when the url does not name its stream. */
export function withStreamQuality(url: string, quality: StreamQuality): string {
  if (HIK_CHANNEL.test(url)) {
    return url.replace(HIK_CHANNEL, (_, prefix: string, id: string) => {
      const channel = Math.max(1, Math.floor(Number(id) / 100));
      return `${prefix}${channel * 100 + (quality === 'hd' ? 1 : 2)}`;
    });
  }
  if (HIK_LEGACY.test(url)) return url.replace(HIK_LEGACY, `$1${quality === 'hd' ? 'main' : 'sub'}$3`);
  if (DAHUA.test(url)) return url.replace(DAHUA, `$1${quality === 'hd' ? '0' : '1'}`);
  if (UNV_MEDIA.test(url)) return url.replace(UNV_MEDIA, `$1${quality === 'hd' ? '1' : '2'}`);
  if (UNV_UNICAST.test(url)) return url.replace(UNV_UNICAST, `$1${quality === 'hd' ? '0' : '1'}$3`);
  if (AJAX.test(url)) return url.replace(AJAX, `$1${quality === 'hd' ? 'm' : 's'}`);
  const pair = RELAY_PAIR.exec(url);
  if (pair) {
    // Keep the case style the relay used: frontSub -> frontMain, FRONTSUB -> FRONTMAIN.
    const word = quality === 'hd' ? 'main' : 'sub';
    const styled = pair[2] === pair[2]!.toUpperCase() ? word.toUpperCase()
      : pair[2]![0] === pair[2]![0]!.toUpperCase() ? word[0]!.toUpperCase() + word.slice(1) : word;
    return url.replace(RELAY_PAIR, `$1${styled}`);
  }
  return url;
}
