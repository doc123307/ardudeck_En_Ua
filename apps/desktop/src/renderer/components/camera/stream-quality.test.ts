import { describe, it, expect } from 'vitest';
import { streamQuality, withStreamQuality } from './stream-quality';

describe('stream quality (main vs sub stream)', () => {
  it('reads and switches Hikvision channel ids', () => {
    const hd = 'rtsp://admin:pw@10.0.0.5:554/Streaming/Channels/101';
    expect(streamQuality(hd)).toBe('hd');
    const sd = withStreamQuality(hd, 'sd');
    expect(sd).toBe('rtsp://admin:pw@10.0.0.5:554/Streaming/Channels/102');
    expect(streamQuality(sd)).toBe('sd');
    expect(withStreamQuality(sd, 'hd')).toBe(hd);
  });

  it('keeps the channel number of a multi-channel recorder', () => {
    expect(withStreamQuality('rtsp://h/ISAPI/Streaming/channels/301', 'sd')).toBe('rtsp://h/ISAPI/Streaming/channels/302');
    expect(withStreamQuality('rtsp://h/Streaming/Channels/1202?transportmode=unicast', 'hd'))
      .toBe('rtsp://h/Streaming/Channels/1201?transportmode=unicast');
  });

  it('handles old Hikvision and Dahua paths', () => {
    expect(withStreamQuality('rtsp://h/h264/ch1/main/av_stream', 'sd')).toBe('rtsp://h/h264/ch1/sub/av_stream');
    expect(streamQuality('rtsp://h/h264/ch1/sub/av_stream')).toBe('sd');
    expect(withStreamQuality('rtsp://h/cam/realmonitor?channel=1&subtype=0', 'sd')).toBe('rtsp://h/cam/realmonitor?channel=1&subtype=1');
  });

  it('leaves urls that do not name their stream alone', () => {
    expect(streamQuality('rtsp://h:8554/live')).toBeNull();
    expect(withStreamQuality('rtsp://h:8554/live', 'sd')).toBe('rtsp://h:8554/live');
    expect(streamQuality(undefined)).toBeNull();
  });
});
