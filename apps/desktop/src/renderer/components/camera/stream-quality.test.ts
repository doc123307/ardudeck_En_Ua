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

  it('switches main/sub path pairs on a relay', () => {
    expect(streamQuality('rtsp://100.67.0.245:8554/frontsub')).toBe('sd');
    expect(withStreamQuality('rtsp://100.67.0.245:8554/frontsub', 'hd')).toBe('rtsp://100.67.0.245:8554/frontmain');
    expect(withStreamQuality('rtsp://100.67.0.245:8554/rearmain', 'sd')).toBe('rtsp://100.67.0.245:8554/rearsub');
    expect(withStreamQuality('rtsp://h:8554/cams/rear_Main?x=1', 'sd')).toBe('rtsp://h:8554/cams/rear_Sub?x=1');
    // a word that merely contains "main" elsewhere is not a stream name
    expect(streamQuality('rtsp://h:8554/maintenance/cam1')).toBeNull();
    // Hikvision paths keep their own rule
    expect(withStreamQuality('rtsp://h/Streaming/Channels/101', 'sd')).toBe('rtsp://h/Streaming/Channels/102');
  });

  it('switches Uniview streams, in both url styles', () => {
    expect(streamQuality('rtsp://u:p@192.168.1.13:554/media/video1')).toBe('hd');
    expect(withStreamQuality('rtsp://u:p@192.168.1.13:554/media/video1', 'sd')).toBe('rtsp://u:p@192.168.1.13:554/media/video2');
    expect(withStreamQuality('rtsp://h/media/video2', 'hd')).toBe('rtsp://h/media/video1');
    // a third stream is neither HD nor SD
    expect(streamQuality('rtsp://h/media/video3')).toBeNull();
    expect(streamQuality('rtsp://h/unicast/c1/s1/live')).toBe('sd');
    expect(withStreamQuality('rtsp://h/unicast/c1/s1/live', 'hd')).toBe('rtsp://h/unicast/c1/s0/live');
  });

  it('switches Ajax streams, named by the camera MAC', () => {
    expect(streamQuality('rtsp://u:p@192.168.4.103:8554/9c756e3db512-0_m')).toBe('hd');
    expect(withStreamQuality('rtsp://u:p@192.168.4.103:8554/9c756e3db512-0_m', 'sd')).toBe('rtsp://u:p@192.168.4.103:8554/9c756e3db512-0_s');
    expect(withStreamQuality('rtsp://h:8554/849459C162A6-0_s', 'hd')).toBe('rtsp://h:8554/849459C162A6-0_m');
    // not a MAC: left alone
    expect(streamQuality('rtsp://h:8554/stream_m')).toBeNull();
  });

  it('leaves urls that do not name their stream alone', () => {
    expect(streamQuality('rtsp://h:8554/live')).toBeNull();
    expect(withStreamQuality('rtsp://h:8554/live', 'sd')).toBe('rtsp://h:8554/live');
    expect(streamQuality(undefined)).toBeNull();
  });
});
