/**
 * Sensors Tab for MAVLink/ArduPilot
 *
 * Displays live sensor telemetry data:
 * - Attitude (roll/pitch/yaw)
 * - GPS status (fix, satellites, HDOP)
 * - Battery (voltage, current, remaining)
 * - Altitude and climb rate
 * - Sensor health indicators
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  Navigation,
  Satellite,
  Battery,
  Gauge,
  Thermometer,
  Activity,
  Wifi,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetry-store';
import { GpsOffsetSection } from './sensors/GpsOffsetSection';
import { t } from '../../i18n';

// Sensor status indicator
function SensorStatus({
  name,
  healthy,
  enabled,
  icon: Icon,
}: {
  name: string;
  healthy: boolean;
  enabled: boolean;
  icon: React.ElementType;
}) {
  const status = !enabled ? 'disabled' : healthy ? 'healthy' : 'unhealthy';
  const colors = {
    healthy: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
    unhealthy: 'bg-red-500/20 border-red-500/30 text-red-400',
    disabled: 'bg-surface border-subtle text-content-secondary',
  };
  const StatusIcon = status === 'healthy' ? CheckCircle : status === 'unhealthy' ? XCircle : AlertTriangle;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${colors[status]}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{name}</span>
      </div>
      <StatusIcon className="w-4 h-4" />
    </div>
  );
}

// Telemetry value card
function TelemetryValue({
  label,
  value,
  unit,
  color = 'text-cyan-400',
  size = 'normal',
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  size?: 'small' | 'normal' | 'large';
}) {
  const sizeClasses = {
    small: 'text-lg',
    normal: 'text-2xl',
    large: 'text-4xl',
  };

  return (
    <div className="text-center">
      <div className={`font-mono ${color} ${sizeClasses[size]}`}>
        {typeof value === 'number' ? value.toFixed(1) : value}
        {unit && <span className="text-xs text-content-secondary ml-1">{unit}</span>}
      </div>
      <div className="text-xs text-content-secondary mt-1">{label}</div>
    </div>
  );
}

const SensorsTab: React.FC = () => {
  const attitude = useTelemetryStore((s) => s.attitude);
  const gps = useTelemetryStore((s) => s.gps);
  const battery = useTelemetryStore((s) => s.battery);
  const vfrHud = useTelemetryStore((s) => s.vfrHud);
  const sysStatus = null as { onboardControlSensorsHealth: number; onboardControlSensorsEnabled: number } | null;
  const heartbeat = null as { autopilot?: string } | null;
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const lastUpdateRef = useRef(0);

  // Track last update time - throttled to once per second to avoid cascading re-renders
  useEffect(() => {
    if (attitude || gps || battery) {
      const now = Date.now();
      if (now - lastUpdateRef.current > 1000) {
        lastUpdateRef.current = now;
        setLastUpdate(new Date());
      }
    }
  }, [attitude, gps, battery]);

  // Parse system status for sensor health
  const sensorHealth = {
    gyro: sysStatus ? (sysStatus.onboardControlSensorsHealth & 1) !== 0 : true,
    accel: sysStatus ? (sysStatus.onboardControlSensorsHealth & 2) !== 0 : true,
    mag: sysStatus ? (sysStatus.onboardControlSensorsHealth & 4) !== 0 : true,
    baro: sysStatus ? (sysStatus.onboardControlSensorsHealth & 8) !== 0 : true,
    gps: sysStatus ? (sysStatus.onboardControlSensorsHealth & 32) !== 0 : gps !== null,
    battery: sysStatus ? (sysStatus.onboardControlSensorsHealth & 128) !== 0 : battery !== null,
  };

  const sensorEnabled = {
    gyro: sysStatus ? (sysStatus.onboardControlSensorsEnabled & 1) !== 0 : true,
    accel: sysStatus ? (sysStatus.onboardControlSensorsEnabled & 2) !== 0 : true,
    mag: sysStatus ? (sysStatus.onboardControlSensorsEnabled & 4) !== 0 : true,
    baro: sysStatus ? (sysStatus.onboardControlSensorsEnabled & 8) !== 0 : true,
    gps: sysStatus ? (sysStatus.onboardControlSensorsEnabled & 32) !== 0 : true,
    battery: sysStatus ? (sysStatus.onboardControlSensorsEnabled & 128) !== 0 : true,
  };

  // GPS fix type names
  const gpsFixTypes: Record<number, string> = {
    0: t('mavlink_config.SensorsTab.noGps'),
    1: t('mavlink_config.SensorsTab.noFix'),
    2: '2D Fix',
    3: '3D Fix',
    4: 'DGPS',
    5: t('mavlink_config.SensorsTab.rtkFloat'),
    6: t('mavlink_config.SensorsTab.rtkFixed'),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={`w-5 h-5 ${lastUpdate ? 'text-emerald-400 animate-pulse' : 'text-content-secondary'}`} />
          <span className="text-sm text-content-secondary">
            {lastUpdate ? t('mavlink_config.SensorsTab.lastUpdate', { v1: lastUpdate.toLocaleTimeString() }) : t('mavlink_config.SensorsTab.waitingForTelemetry')}
          </span>
        </div>
        {heartbeat && (
          <div className="flex items-center gap-2 text-sm text-content-secondary">
            <Wifi className="w-4 h-4" />
            <span>{heartbeat.autopilot || t('mavlink_config.SensorsTab.unknown')}</span>
          </div>
        )}
      </div>

      {/* Main telemetry grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Attitude Card */}
        <div className="bg-surface rounded-xl border border-subtle p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Compass className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-content">{t('mavlink_config.SensorsTab.attitude')}</h3>
              <p className="text-xs text-content-secondary">{t('mavlink_config.SensorsTab.aircraftOrientation')}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.roll')}
              value={attitude?.roll ?? 0}
              unit="°"
              color="text-blue-400"
            />
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.pitch')}
              value={attitude?.pitch ?? 0}
              unit="°"
              color="text-emerald-400"
            />
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.yaw')}
              value={attitude?.yaw ?? 0}
              unit="°"
              color="text-orange-400"
            />
          </div>

          {/* Visual attitude indicator placeholder */}
          <div className="h-24 bg-surface-raised rounded-lg flex items-center justify-center">
            <div
              className="w-16 h-16 border-2 border-blue-400 rounded"
              style={{
                transform: `rotate(${attitude?.roll ?? 0}deg)`,
              }}
            >
              <div
                className="w-full h-1/2 bg-blue-400/20"
                style={{
                  transform: `translateY(${-(attitude?.pitch ?? 0) / 2}px)`,
                }}
              />
            </div>
          </div>
        </div>

        {/* GPS Card */}
        <div className="bg-surface rounded-xl border border-subtle p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Satellite className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-content">{t('mavlink_config.SensorsTab.gpsStatus')}</h3>
              <p className="text-xs text-content-secondary">{t('mavlink_config.SensorsTab.positionAndFixQuality')}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.fixType')}
              value={gpsFixTypes[gps?.fixType ?? 0] || 'Unknown'}
              color={gps?.fixType && gps.fixType >= 3 ? 'text-emerald-400' : 'text-amber-400'}
            />
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.satellites')}
              value={gps?.satellites ?? 0}
              color={gps?.satellites && gps.satellites >= 8 ? 'text-emerald-400' : 'text-amber-400'}
            />
            <TelemetryValue
              label="HDOP"
              value={gps?.hdop ?? 99}
              color={gps?.hdop && gps.hdop < 2 ? 'text-emerald-400' : 'text-amber-400'}
            />
          </div>

          {gps && (
            <div className="bg-surface-raised rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-content-secondary">{t('mavlink_config.SensorsTab.latitude')}</span>
                <span className="font-mono text-content">{gps.lat?.toFixed(6) ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-content-secondary">{t('mavlink_config.SensorsTab.longitude')}</span>
                <span className="font-mono text-content">{gps.lon?.toFixed(6) ?? 'N/A'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Battery Card */}
        <div className="bg-surface rounded-xl border border-subtle p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Battery className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-content">{t('mavlink_config.SensorsTab.battery')}</h3>
              <p className="text-xs text-content-secondary">{t('mavlink_config.SensorsTab.powerStatus')}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.voltage')}
              value={battery?.voltage ?? 0}
              unit="V"
              color={battery?.voltage && battery.voltage > 3.5 * 4 ? 'text-emerald-400' : 'text-red-400'}
            />
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.current')}
              value={battery?.current ?? 0}
              unit="A"
              color="text-amber-400"
            />
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.remaining')}
              value={battery?.remaining ?? 0}
              unit="%"
              color={battery?.remaining && battery.remaining > 20 ? 'text-emerald-400' : 'text-red-400'}
            />
          </div>

          {/* Battery bar */}
          <div className="space-y-1">
            <div className="h-3 bg-surface-inset rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (battery?.remaining ?? 0) > 50
                    ? 'bg-emerald-500'
                    : (battery?.remaining ?? 0) > 20
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${battery?.remaining ?? 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-content-tertiary">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Altitude & Speed Card */}
        <div className="bg-surface rounded-xl border border-subtle p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Gauge className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-content">{t('mavlink_config.SensorsTab.flightData')}</h3>
              <p className="text-xs text-content-secondary">{t('mavlink_config.SensorsTab.altitudeAndSpeed')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.altitude')}
              value={vfrHud?.alt ?? 0}
              unit="m"
              color="text-purple-400"
              size="large"
            />
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.climbRate')}
              value={vfrHud?.climb ?? 0}
              unit="m/s"
              color={(vfrHud?.climb ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}
              size="large"
            />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.groundSpeed')}
              value={vfrHud?.groundspeed ?? 0}
              unit="m/s"
              color="text-cyan-400"
              size="small"
            />
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.airSpeed')}
              value={vfrHud?.airspeed ?? 0}
              unit="m/s"
              color="text-cyan-400"
              size="small"
            />
            <TelemetryValue
              label={t('mavlink_config.SensorsTab.heading')}
              value={vfrHud?.heading ?? 0}
              unit="°"
              color="text-cyan-400"
              size="small"
            />
          </div>
        </div>
      </div>

      {/* Sensor Health */}
      <div className="bg-surface rounded-xl border border-subtle p-4 space-y-4">
        <h3 className="text-sm font-medium text-content">{t('mavlink_config.SensorsTab.sensorHealth')}</h3>
        <div className="grid grid-cols-6 gap-3">
          <SensorStatus name="Gyro" healthy={sensorHealth.gyro} enabled={sensorEnabled.gyro} icon={Activity} />
          <SensorStatus name="Accel" healthy={sensorHealth.accel} enabled={sensorEnabled.accel} icon={Navigation} />
          <SensorStatus name="Compass" healthy={sensorHealth.mag} enabled={sensorEnabled.mag} icon={Compass} />
          <SensorStatus name="Baro" healthy={sensorHealth.baro} enabled={sensorEnabled.baro} icon={Thermometer} />
          <SensorStatus name="GPS" healthy={sensorHealth.gps} enabled={sensorEnabled.gps} icon={Satellite} />
          <SensorStatus name="Battery" healthy={sensorHealth.battery} enabled={sensorEnabled.battery} icon={Battery} />
        </div>
      </div>

      <GpsOffsetSection />

      {/* No data warning */}
      {!attitude && !gps && !battery && (
        <div className="bg-amber-500/10 border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <p className="text-sm text-amber-400">
            {t('mavlink_config.SensorsTab.noTelemetryDataReceivedMakeSure')}
          </p>
        </div>
      )}
    </div>
  );
};

export default SensorsTab;
