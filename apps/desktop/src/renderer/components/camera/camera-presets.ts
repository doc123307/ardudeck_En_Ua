/**
 * Built-in camera source presets.
 *
 * Defaults sourced from current (2025-2026) vendor docs. Port 8554 is the
 * de-facto RTSP standard across the serious payloads (SIYI / Herelink /
 * RunCam WiFiLink). URLs are editable after the preset is applied — these are
 * just the known-good starting points so the operator picks a payload instead
 * of typing a URL from memory.
 */

import type { CameraPreset } from '../../../shared/camera-types';
import { t } from '../../i18n';

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'mavlink',
    get label() { return t('camera.camera_presets.advertisedByVehicleMavlink'); },
    kind: 'mavlink',
    get note() { return t('camera.camera_presets.autoDiscoversTheStreamUriFrom'); },
  },
  {
    id: 'siyi-a8',
    get label() { return t('camera.camera_presets.siyiA8MiniZr10Zr30'); },
    kind: 'rtsp',
    url: 'rtsp://192.168.144.25:8554/main.264',
    hfovDeg: 81,
    get note() { return t('camera.camera_presets.cameraAutopilotMustShareThe192'); },
  },
  {
    id: 'siyi-zt6',
    label: 'SIYI ZT6 / ZT30 (RGB)',
    kind: 'rtsp',
    url: 'rtsp://192.168.144.25:8554/video2',
    hfovDeg: 81,
    get note() { return t('camera.camera_presets.multiSensorCamsExposeVideo1Ir'); },
  },
  {
    id: 'herelink',
    get label() { return t('camera.camera_presets.herelinkGroundUnit'); },
    kind: 'rtsp',
    url: 'rtsp://192.168.43.1:8554/fpv_stream',
    get note() { return t('camera.camera_presets.wifiHotspotModeUsbTetherUses'); },
  },
  {
    id: 'runcam-wifilink',
    get label() { return t('camera.camera_presets.runcamWifilinkOpenipcWfbNg'); },
    kind: 'wfbng',
    url: 'udp://0.0.0.0:5600',
  },
  {
    id: 'rubyfpv',
    get label() { return t('camera.camera_presets.rubyfpvRelayedVideo'); },
    kind: 'rubyfpv',
    url: 'udp://127.0.0.1:5600',
    get note() { return t('camera.camera_presets.enableVideoForwardingToLocalNetwork'); },
  },
  {
    id: 'rtsp',
    get label() { return t('camera.camera_presets.customRtspUrl'); },
    kind: 'rtsp',
    url: 'rtsp://',
    get note() { return t('camera.camera_presets.anyRtspSourceTheHubRepublishes'); },
  },
  {
    id: 'ardudeck-sim',
    get label() { return t('camera.camera_presets.ardudeckSimulatorFpvFeed'); },
    kind: 'rtsp',
    url: 'rtsp://127.0.0.1:8654/fpv',
    get note() { return t('camera.camera_presets.tickStreamFpvToArdudeckIn'); },
  },
  {
    id: 'rtp-udp',
    get label() { return t('camera.camera_presets.customRtpUdpH264'); },
    kind: 'rtp-udp',
    url: 'udp://0.0.0.0:5600',
    get note() { return t('camera.camera_presets.rawH264OverUdpE'); },
  },
  {
    id: 'srt',
    get label() { return t('camera.camera_presets.customSrt'); },
    kind: 'srt',
    url: 'srt://0.0.0.0:8890?mode=listener',
    get note() { return t('camera.camera_presets.higherLatencyThanRtpButResilient'); },
  },
  {
    id: 'webrtc',
    get label() { return t('camera.camera_presets.customWebrtcWhep'); },
    kind: 'webrtc',
    url: 'https://',
    get note() { return t('camera.camera_presets.aWhepEndpointPublishedByA'); },
  },
  {
    id: 'uvc',
    get label() { return t('camera.camera_presets.usbHdmiCaptureDevice'); },
    kind: 'uvc',
    get note() { return t('camera.camera_presets.analogFpvToUsbDongleOr'); },
  },
];

export function presetById(id: string): CameraPreset | undefined {
  return CAMERA_PRESETS.find((p) => p.id === id);
}
