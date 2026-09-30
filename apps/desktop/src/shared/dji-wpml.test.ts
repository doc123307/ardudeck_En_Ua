import { describe, it, expect } from 'vitest';
import { buildDjiWpml, parseDjiWpml } from './dji-wpml';
import { MAV_CMD, MAV_FRAME, type MissionItem } from './mission-types';

const item = (over: Partial<MissionItem>): MissionItem => ({
  seq: 0,
  frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
  command: MAV_CMD.NAV_WAYPOINT,
  current: false,
  autocontinue: true,
  param1: 0, param2: 0, param3: 0, param4: 0,
  latitude: 42.44, longitude: 19.26, altitude: 50,
  ...over,
});

describe('buildDjiWpml', () => {
  it('exports nav waypoints as placemarks, skipping non-nav and takeoff items', () => {
    const { waylinesWpml, waypointCount } = buildDjiWpml([
      item({ command: MAV_CMD.NAV_TAKEOFF, altitude: 10 }),
      item({ seq: 1, latitude: 42.441, longitude: 19.261, altitude: 80 }),
      item({ seq: 2, command: MAV_CMD.DO_SET_ROI, latitude: 42.45, longitude: 19.27 }),
      item({ seq: 3, latitude: 42.442, longitude: 19.262, altitude: 80 }),
    ], 1234567890);
    expect(waypointCount).toBe(2);
    expect(waylinesWpml).toContain('<coordinates>19.261000000,42.441000000</coordinates>');
    expect(waylinesWpml).toContain('<wpml:index>1</wpml:index>');
    expect(waylinesWpml).not.toContain('19.270000000');
    expect(waylinesWpml).toContain('<wpml:executeHeight>80</wpml:executeHeight>');
    expect(waylinesWpml).toContain('<wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>');
    expect(waylinesWpml).toContain('<wpml:useStraightLine>1</wpml:useStraightLine>');
  });

  it('applies DO_CHANGE_SPEED to subsequent waypoints, clamped to the DJI range', () => {
    const { waylinesWpml } = buildDjiWpml([
      item({}),
      item({ seq: 1, command: MAV_CMD.DO_CHANGE_SPEED, param2: 22, latitude: 0, longitude: 0 }),
      item({ seq: 2, latitude: 42.441 }),
    ], 0);
    expect(waylinesWpml).toContain('<wpml:waypointSpeed>10</wpml:waypointSpeed>');
    expect(waylinesWpml).toContain('<wpml:waypointSpeed>15</wpml:waypointSpeed>');
  });

  it('finishes with autoLand when the mission ends in NAV_LAND, goHome otherwise', () => {
    const land = buildDjiWpml([item({}), item({ seq: 1, command: MAV_CMD.NAV_LAND })], 0);
    expect(land.waylinesWpml).toContain('<wpml:finishAction>autoLand</wpml:finishAction>');
    const rtl = buildDjiWpml([item({}), item({ seq: 1, command: MAV_CMD.NAV_RETURN_TO_LAUNCH, latitude: 0, longitude: 0 })], 0);
    expect(rtl.waylinesWpml).toContain('<wpml:finishAction>goHome</wpml:finishAction>');
  });

  it('round-trips through parseDjiWpml', () => {
    const src = [
      item({ latitude: 42.44, longitude: 19.26, altitude: 50 }),
      item({ seq: 1, latitude: 42.441, longitude: 19.261, altitude: 80 }),
      item({ seq: 2, command: MAV_CMD.NAV_RETURN_TO_LAUNCH, latitude: 0, longitude: 0, altitude: 0 }),
    ];
    const { waylinesWpml } = buildDjiWpml(src, 0);
    const parsed = parseDjiWpml(waylinesWpml);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ command: MAV_CMD.NAV_WAYPOINT, latitude: 42.44, longitude: 19.26, altitude: 50, frame: MAV_FRAME.GLOBAL_RELATIVE_ALT });
    expect(parsed[1]).toMatchObject({ latitude: 42.441, longitude: 19.261, altitude: 80 });
    expect(parsed[2]!.command).toBe(MAV_CMD.NAV_RETURN_TO_LAUNCH);
    expect(parsed.map((i) => i.seq)).toEqual([0, 1, 2]);
    expect(parsed.every((i) => !i.current)).toBe(true);
  });

  it('parses speed changes and autoLand finish into DO_CHANGE_SPEED and NAV_LAND', () => {
    const { waylinesWpml } = buildDjiWpml([
      item({}),
      item({ seq: 1, command: MAV_CMD.DO_CHANGE_SPEED, param2: 5, latitude: 0, longitude: 0 }),
      item({ seq: 2, latitude: 42.441 }),
      item({ seq: 3, command: MAV_CMD.NAV_LAND, latitude: 0, longitude: 0 }),
    ], 0);
    const parsed = parseDjiWpml(waylinesWpml);
    const cmds = parsed.map((i) => i.command);
    expect(cmds).toEqual([MAV_CMD.NAV_WAYPOINT, MAV_CMD.DO_CHANGE_SPEED, MAV_CMD.NAV_WAYPOINT, MAV_CMD.NAV_LAND]);
    expect(parsed[1]!.param2).toBe(5);
  });

  it('stamps create/update time into template.kml', () => {
    const { templateKml } = buildDjiWpml([item({})], 1784557935882);
    expect(templateKml).toContain('<wpml:createTime>1784557935882</wpml:createTime>');
    expect(templateKml).toContain('<wpml:author>STOHID</wpml:author>');
  });
});
