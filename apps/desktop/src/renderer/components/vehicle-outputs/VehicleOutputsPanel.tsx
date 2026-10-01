import { useActiveVehicleStore } from '../../stores/active-vehicle-store';
import { RelayButtons } from './RelayButtons';

/** Dock panel with the vehicle output buttons, for workspaces that want them apart from the video. */
export function VehicleOutputsPanel() {
  const vehicleKey = useActiveVehicleStore((s) => s.activeVehicleKey);
  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto bg-surface p-2">
      <RelayButtons vehicleKey={vehicleKey} />
    </div>
  );
}
