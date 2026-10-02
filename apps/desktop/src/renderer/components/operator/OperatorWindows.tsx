/**
 * What the operator's pop-out windows show: one camera, or the map. They run in a
 * separate window (see detached/component-registry.ts), meant for a second monitor.
 * Closing the window puts the camera or the map back on the operator screen.
 */

import { VideoOff } from 'lucide-react';
import { CameraView } from '../camera/CameraView';
import { CameraControlBar, hasCameraControls } from '../camera/CameraControlBar';
import { useCameraStore } from '../../stores/camera-store';
import { useActiveVehicleStore } from '../../stores/active-vehicle-store';
import { useFleetVehicles } from '../../hooks/useFleet';
import { plainOsd } from './OperatorCameras';
import { OperatorMap } from './OperatorMiniMap';
import { t } from '../../i18n';

export function OperatorCameraWindow({ sourceId }: { sourceId?: unknown }) {
  const source = useCameraStore((s) => (typeof sourceId === 'string' ? s.sources[sourceId] : undefined));
  const osd = useCameraStore((s) => s.osd);
  const activeKey = useActiveVehicleStore((s) => s.activeVehicleKey);
  const fleet = useFleetVehicles();
  const vehicle = fleet.find((v) => v.key === activeKey) ?? null;

  if (!source) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black p-6 text-center text-content-secondary">
        <VideoOff className="h-10 w-10 text-content-tertiary" />
        <p className="text-sm">{t('operator.OperatorCameras.cameraGone')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-black">
      <div className="relative min-h-0 flex-1">
        <CameraView source={source} vehicle={vehicle} isPrimary={false} osd={plainOsd(osd)} />
      </div>
      {hasCameraControls(source) && (
        <div className="flex shrink-0 justify-center border-t border-subtle bg-surface px-2 py-1.5">
          <CameraControlBar source={source} />
        </div>
      )}
    </div>
  );
}

export function OperatorMapWindow() {
  return <OperatorMap />;
}
