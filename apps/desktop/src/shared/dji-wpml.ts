/**
 * DJI WPML (KMZ waypoint mission) export - issue #121.
 *
 * A DJI-compatible .kmz is a zip containing wpmz/template.kml (static mission
 * config) and wpmz/waylines.wpml (the waypoints). Format reference:
 * https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/waylines-wpml.html
 * Structure and defaults match the community-verified sample attached to the
 * issue (straight vectors, followWayline heading, stop-at-point turns).
 *
 * This module only generates the two XML documents; zipping happens in the
 * main process (adm-zip) so the renderer/shared code stays Node-free.
 */
import { MAV_CMD, MAV_FRAME, type MissionItem } from './mission-types';

export interface DjiWpmlFiles {
  templateKml: string;
  waylinesWpml: string;
  waypointCount: number;
}

/** Nav commands whose coordinates become DJI waypoints. */
const WAYPOINT_COMMANDS: Set<number> = new Set([
  MAV_CMD.NAV_WAYPOINT,
  MAV_CMD.NAV_LOITER_UNLIM,
  MAV_CMD.NAV_LOITER_TURNS,
  MAV_CMD.NAV_LOITER_TIME,
  MAV_CMD.NAV_LOITER_TO_ALT,
  MAV_CMD.NAV_SPLINE_WAYPOINT,
]);

// DJI Fly accepts 1-15 m/s for wayline/waypoint speeds.
const clampSpeed = (v: number): number => Math.min(15, Math.max(1, v));
const DEFAULT_SPEED = 10;

function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = Math.PI / 180;
  const dLon = (bLon - aLon) * toRad;
  const y = Math.sin(dLon) * Math.cos(bLat * toRad);
  const x =
    Math.cos(aLat * toRad) * Math.sin(bLat * toRad) -
    Math.sin(aLat * toRad) * Math.cos(bLat * toRad) * Math.cos(dLon);
  let brg = (Math.atan2(y, x) * 180) / Math.PI;
  if (brg > 180) brg -= 360;
  if (brg < -180) brg += 360;
  return Math.round(brg);
}

function missionConfigXml(finishAction: 'goHome' | 'autoLand', globalSpeed: number): string {
  return [
    '    <wpml:missionConfig>',
    '      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>',
    `      <wpml:finishAction>${finishAction}</wpml:finishAction>`,
    '      <wpml:exitOnRCLost>goContinue</wpml:exitOnRCLost>',
    '      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>',
    '      <wpml:takeOffSecurityHeight>1.2</wpml:takeOffSecurityHeight>',
    `      <wpml:globalTransitionalSpeed>${globalSpeed}</wpml:globalTransitionalSpeed>`,
    '      <wpml:droneInfo>',
    '        <wpml:droneEnumValue>68</wpml:droneEnumValue>',
    '        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>',
    '      </wpml:droneInfo>',
    '    </wpml:missionConfig>',
  ].join('\n');
}

export function buildDjiWpml(items: MissionItem[], createTimeMs: number): DjiWpmlFiles {
  interface Wp { lat: number; lon: number; alt: number; speed: number; frame: number }
  const wps: Wp[] = [];
  let speed = DEFAULT_SPEED;
  for (const item of items) {
    if (item.command === MAV_CMD.DO_CHANGE_SPEED && item.param2 > 0) {
      speed = clampSpeed(item.param2);
      continue;
    }
    if (!WAYPOINT_COMMANDS.has(item.command)) continue;
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) continue;
    if (item.latitude === 0 && item.longitude === 0) continue;
    wps.push({ lat: item.latitude, lon: item.longitude, alt: item.altitude, speed, frame: item.frame });
  }

  // A trailing LAND lands in place; anything else (incl. RTL or nothing) goes home.
  const lastNav = [...items].reverse().find((i) => i.command <= 95); // MAV nav command range
  const finishAction: 'goHome' | 'autoLand' =
    lastNav?.command === MAV_CMD.NAV_LAND ? 'autoLand' : 'goHome';

  // ArduDeck plans in relative-alt frames almost always; absolute frames map
  // to ellipsoid height, which is the closest WPML equivalent.
  const relative = wps.every(
    (w) => w.frame !== MAV_FRAME.GLOBAL && w.frame !== MAV_FRAME.GLOBAL_INT,
  );
  const heightMode = relative ? 'relativeToStartPoint' : 'WGS84';
  const globalSpeed = wps[0]?.speed ?? DEFAULT_SPEED;
  const config = missionConfigXml(finishAction, globalSpeed);

  const placemarks = wps.map((w, i) => {
    const next = wps[i + 1];
    const prev = wps[i - 1];
    const heading = next
      ? bearingDeg(w.lat, w.lon, next.lat, next.lon)
      : prev
        ? bearingDeg(prev.lat, prev.lon, w.lat, w.lon)
        : 0;
    return [
      '      <Placemark>',
      '        <Point>',
      `          <coordinates>${w.lon.toFixed(9)},${w.lat.toFixed(9)}</coordinates>`,
      '        </Point>',
      `        <wpml:index>${i}</wpml:index>`,
      `        <wpml:executeHeight>${Number(w.alt.toFixed(1))}</wpml:executeHeight>`,
      `        <wpml:waypointSpeed>${w.speed}</wpml:waypointSpeed>`,
      '        <wpml:waypointHeadingParam>',
      '          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>',
      `          <wpml:waypointHeadingAngle>${heading}</wpml:waypointHeadingAngle>`,
      '        </wpml:waypointHeadingParam>',
      '        <wpml:waypointTurnParam>',
      '          <wpml:waypointTurnMode>toPointAndStopWithDiscontinuityCurvature</wpml:waypointTurnMode>',
      '          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>',
      '        </wpml:waypointTurnParam>',
      '        <wpml:useStraightLine>1</wpml:useStraightLine>',
      '        <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>',
      '        <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>',
      '      </Placemark>',
    ].join('\n');
  });

  const templateKml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">',
    '  <Document>',
    '    <wpml:author>STOHID</wpml:author>',
    `    <wpml:createTime>${createTimeMs}</wpml:createTime>`,
    `    <wpml:updateTime>${createTimeMs}</wpml:updateTime>`,
    config,
    '    <Folder>',
    '      <name>Waylines Folder</name>',
    '      <open>1</open>',
    '    </Folder>',
    '  </Document>',
    '</kml>',
  ].join('\n');

  const waylinesWpml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">',
    '  <Document>',
    config,
    '    <Folder>',
    '      <wpml:templateId>0</wpml:templateId>',
    `      <wpml:executeHeightMode>${heightMode}</wpml:executeHeightMode>`,
    '      <wpml:waylineId>0</wpml:waylineId>',
    '      <wpml:distance>0</wpml:distance>',
    '      <wpml:duration>0</wpml:duration>',
    `      <wpml:autoFlightSpeed>${globalSpeed}</wpml:autoFlightSpeed>`,
    ...placemarks,
    '    </Folder>',
    '  </Document>',
    '</kml>',
  ].join('\n');

  return { templateKml, waylinesWpml, waypointCount: wps.length };
}

const tagNum = (block: string, tag: string): number | null => {
  const m = block.match(new RegExp(`<wpml:${tag}>\\s*(-?[\\d.]+)\\s*</wpml:${tag}>`));
  return m ? parseFloat(m[1]!) : null;
};

/**
 * Parse a DJI waylines.wpml document back into mission items. Inverse of
 * buildDjiWpml, tolerant of DJI Fly-authored files: placemark coordinates +
 * executeHeight become NAV_WAYPOINTs, speed changes become DO_CHANGE_SPEED,
 * and the finishAction becomes a trailing RTL or LAND. Gimbal/camera actions
 * have no MAVLink mission equivalent here and are ignored.
 */
export function parseDjiWpml(waylinesWpml: string): MissionItem[] {
  const heightMode = waylinesWpml.match(/<wpml:executeHeightMode>\s*(\w+)\s*<\/wpml:executeHeightMode>/)?.[1];
  const frame = heightMode === 'relativeToStartPoint' || heightMode === undefined
    ? MAV_FRAME.GLOBAL_RELATIVE_ALT
    : MAV_FRAME.GLOBAL;

  const base: Omit<MissionItem, 'seq' | 'command' | 'latitude' | 'longitude' | 'altitude'> = {
    frame,
    current: false,
    autocontinue: true,
    param1: 0, param2: 0, param3: 0, param4: 0,
  };

  const items: MissionItem[] = [];
  let seq = 0;
  let speed = tagNum(waylinesWpml, 'autoFlightSpeed');

  for (const [, block] of waylinesWpml.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
    const coords = block!.match(/<coordinates>\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/);
    if (!coords) continue;
    const lon = parseFloat(coords[1]!);
    const lat = parseFloat(coords[2]!);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    // template.kml variants carry wpml:height instead of executeHeight
    const alt = tagNum(block!, 'executeHeight') ?? tagNum(block!, 'height') ?? 0;

    const wpSpeed = tagNum(block!, 'waypointSpeed');
    if (wpSpeed !== null && speed !== null && wpSpeed !== speed) {
      items.push({ ...base, seq: seq++, command: MAV_CMD.DO_CHANGE_SPEED, param1: 1, param2: wpSpeed, latitude: 0, longitude: 0, altitude: 0 });
    }
    if (wpSpeed !== null) speed = wpSpeed;

    items.push({ ...base, seq: seq++, command: MAV_CMD.NAV_WAYPOINT, latitude: lat, longitude: lon, altitude: alt });
  }

  const finish = waylinesWpml.match(/<wpml:finishAction>\s*(\w+)\s*<\/wpml:finishAction>/)?.[1];
  if (items.length > 0 && finish === 'goHome') {
    items.push({ ...base, seq: seq++, command: MAV_CMD.NAV_RETURN_TO_LAUNCH, latitude: 0, longitude: 0, altitude: 0 });
  } else if (items.length > 0 && finish === 'autoLand') {
    items.push({ ...base, seq: seq++, command: MAV_CMD.NAV_LAND, latitude: 0, longitude: 0, altitude: 0 });
  }

  return items;
}
