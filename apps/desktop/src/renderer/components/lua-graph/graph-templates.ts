/**
 * Pre-built graph templates for common ArduPilot scripting patterns.
 * Each template is hand-laid-out with comment annotations, generous spacing,
 * and a clear left-to-right data flow to serve as learning examples.
 */
import type { GraphFile } from './lua-graph-types';
import { t } from '../../i18n';

export interface GraphTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  graph: GraphFile;
}

export const GRAPH_TEMPLATES: GraphTemplate[] = [
  // ─── Low Battery Warning ──────────────────────────────────────
  {
    id: 'low-battery-warning',
    name: 'Low Battery Warning',
    get description() { return t('lua_graph.graph_templates.sendAGcsAlertWhenBattery'); },
    category: 'Safety',
    graph: {
      version: 1,
      name: 'Low Battery Warning',
      get description() { return t('lua_graph.graph_templates.sendAGcsAlertWhenBattery2'); },
      runIntervalMs: 1000,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Stage annotations ──
        {
          id: 'comment_input',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readBatteryVoltageFromTheFlight'); } },
          },
        },
        {
          id: 'comment_logic',
          type: 'flow-comment',
          position: { x: 400, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.isVoltageBelowOurSafetyLimit'); } },
          },
        },
        {
          id: 'comment_action',
          type: 'flow-comment',
          position: { x: 740, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.warnThePilotViaGcsMessage'); } },
          },
        },
        // ── Data flow ──
        {
          id: 'sensor',
          type: 'sensor-battery',
          position: { x: 60, y: 100 },
          data: {
            definitionType: 'sensor-battery',
            get label() { return t('lua_graph.graph_templates.battery'); },
            category: 'sensors',
            propertyValues: { instance: 0 },
          },
        },
        {
          id: 'compare',
          type: 'logic-compare',
          position: { x: 420, y: 110 },
          data: {
            definitionType: 'logic-compare',
            get label() { return t('lua_graph.graph_templates.voltage142'); },
            category: 'logic',
            propertyValues: { operator: '<' },
          },
        },
        {
          id: 'threshold',
          type: 'var-constant',
          position: { x: 220, y: 290 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.thresholdV'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '14.2' },
          },
        },
        {
          id: 'alert',
          type: 'action-gcs-text',
          position: { x: 740, y: 120 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.warnLowBattery'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.warningLowBatteryVoltage'); }, severity: 4 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'sensor', target: 'compare', sourceHandle: 'voltage', targetHandle: 'a' },
        { id: 'e2', source: 'threshold', target: 'compare', sourceHandle: 'value', targetHandle: 'b' },
        { id: 'e3', source: 'compare', target: 'alert', sourceHandle: 'result', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.9 },
    },
  },

  // ─── Geofence Alert ───────────────────────────────────────────
  {
    id: 'geofence-alert',
    name: 'Geofence Alert',
    get description() { return t('lua_graph.graph_templates.warnWhenAltitudeExceedsASafety'); },
    category: 'Safety',
    graph: {
      version: 1,
      name: 'Geofence Alert',
      get description() { return t('lua_graph.graph_templates.warnWhenAltitudeExceedsASafety2'); },
      runIntervalMs: 500,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Annotations ──
        {
          id: 'comment_input',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readCurrentBarometricAltitude'); } },
          },
        },
        {
          id: 'comment_logic',
          type: 'flow-comment',
          position: { x: 380, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.hasVehicleExceededTheAltitudeFence'); } },
          },
        },
        {
          id: 'comment_action',
          type: 'flow-comment',
          position: { x: 720, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.alertGcsWithUrgentWarning'); } },
          },
        },
        // ── Data flow ──
        {
          id: 'sensor',
          type: 'sensor-baro-alt',
          position: { x: 60, y: 110 },
          data: {
            definitionType: 'sensor-baro-alt',
            get label() { return t('lua_graph.graph_templates.baroAltitude'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'compare',
          type: 'logic-compare',
          position: { x: 400, y: 110 },
          data: {
            definitionType: 'logic-compare',
            get label() { return t('lua_graph.graph_templates.alt120m'); },
            category: 'logic',
            propertyValues: { operator: '>' },
          },
        },
        {
          id: 'max_alt',
          type: 'var-constant',
          position: { x: 200, y: 280 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.maxAltitudeM'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '120' },
          },
        },
        {
          id: 'alert',
          type: 'action-gcs-text',
          position: { x: 740, y: 120 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.altitudeWarning'); },
            category: 'actions',
            propertyValues: { message: 'ALTITUDE LIMIT EXCEEDED!', severity: 4 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'sensor', target: 'compare', sourceHandle: 'alt_m', targetHandle: 'a' },
        { id: 'e2', source: 'max_alt', target: 'compare', sourceHandle: 'value', targetHandle: 'b' },
        { id: 'e3', source: 'compare', target: 'alert', sourceHandle: 'result', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.9 },
    },
  },

  // ─── Mode Announcement ────────────────────────────────────────
  {
    id: 'mode-announcement',
    name: 'Mode Announcement',
    get description() { return t('lua_graph.graph_templates.sendAGcsMessageWheneverThe'); },
    category: 'Utility',
    graph: {
      version: 1,
      name: 'Mode Announcement',
      get description() { return t('lua_graph.graph_templates.sendAGcsMessageWheneverThe2'); },
      runIntervalMs: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Annotations ──
        {
          id: 'comment_input',
          type: 'flow-comment',
          position: { x: 40, y: 30 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readTheRcModeSwitchChannel'); } },
          },
        },
        {
          id: 'comment_detect',
          type: 'flow-comment',
          position: { x: 380, y: 30 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.onlyFireWhenTheValueActually'); } },
          },
        },
        {
          id: 'comment_action',
          type: 'flow-comment',
          position: { x: 700, y: 30 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.notifyPilotOfTheSwitchChange'); } },
          },
        },
        // ── Data flow ──
        {
          id: 'rc_input',
          type: 'sensor-rc-channel',
          position: { x: 60, y: 120 },
          data: {
            definitionType: 'sensor-rc-channel',
            get label() { return t('lua_graph.graph_templates.modeSwitchCh5'); },
            category: 'sensors',
            propertyValues: { channel: 5 },
          },
        },
        {
          id: 'on_change',
          type: 'timing-on-change',
          position: { x: 400, y: 125 },
          data: {
            definitionType: 'timing-on-change',
            get label() { return t('lua_graph.graph_templates.detectChange'); },
            category: 'timing',
            propertyValues: {},
          },
        },
        {
          id: 'announce',
          type: 'action-gcs-text',
          position: { x: 720, y: 125 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.modeChanged'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.flightModeSwitchChanged'); }, severity: 6 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'rc_input', target: 'on_change', sourceHandle: 'value_us', targetHandle: 'value' },
        { id: 'e2', source: 'on_change', target: 'announce', sourceHandle: 'changed', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.9 },
    },
  },

  // ─── Landing Gear ─────────────────────────────────────────────
  {
    id: 'landing-gear',
    name: 'Landing Gear',
    get description() { return t('lua_graph.graph_templates.autoRetractDeployLandingGearBased'); },
    category: 'Automation',
    graph: {
      version: 1,
      name: 'Landing Gear',
      get description() { return t('lua_graph.graph_templates.autoRetractDeployLandingGearBased2'); },
      runIntervalMs: 500,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Annotations ──
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 30, y: 10 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.sense'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readCurrentAltitudeAboveGround'); } },
          },
        },
        {
          id: 'comment_decide',
          type: 'flow-comment',
          position: { x: 370, y: 10 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.decide'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.aboveGearChangeAltitude'); } },
          },
        },
        {
          id: 'comment_branch',
          type: 'flow-comment',
          position: { x: 660, y: 10 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.branch'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.takeDifferentActionBasedOnResult'); } },
          },
        },
        // ── Sensor column ──
        {
          id: 'altitude',
          type: 'sensor-baro-alt',
          position: { x: 50, y: 100 },
          data: {
            definitionType: 'sensor-baro-alt',
            get label() { return t('lua_graph.graph_templates.altitude'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'gear_alt',
          type: 'var-constant',
          position: { x: 50, y: 260 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.gearAltM'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '10' },
          },
        },
        // ── Logic column ──
        {
          id: 'compare',
          type: 'logic-compare',
          position: { x: 380, y: 100 },
          data: {
            definitionType: 'logic-compare',
            get label() { return t('lua_graph.graph_templates.above10m'); },
            category: 'logic',
            propertyValues: { operator: '>' },
          },
        },
        {
          id: 'branch',
          type: 'logic-if-else',
          position: { x: 680, y: 110 },
          data: {
            definitionType: 'logic-if-else',
            get label() { return t('lua_graph.graph_templates.branch'); },
            category: 'logic',
            propertyValues: {},
          },
        },
        // ── TRUE path (retract — top) ──
        {
          id: 'retract_pwm',
          type: 'var-constant',
          position: { x: 900, y: 30 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.retractedPwm'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '1100' },
          },
        },
        {
          id: 'retract',
          type: 'action-set-servo',
          position: { x: 1000, y: 100 },
          data: {
            definitionType: 'action-set-servo',
            get label() { return t('lua_graph.graph_templates.retractGear'); },
            category: 'actions',
            propertyValues: { servo_num: 9 },
          },
        },
        // ── FALSE path (deploy — bottom) ──
        {
          id: 'deploy_pwm',
          type: 'var-constant',
          position: { x: 900, y: 260 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.deployedPwm'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '1900' },
          },
        },
        {
          id: 'deploy',
          type: 'action-set-servo',
          position: { x: 1000, y: 330 },
          data: {
            definitionType: 'action-set-servo',
            get label() { return t('lua_graph.graph_templates.deployGear'); },
            category: 'actions',
            propertyValues: { servo_num: 9 },
          },
        },
      ],
      edges: [
        // Sensor → Compare
        { id: 'e1', source: 'altitude', target: 'compare', sourceHandle: 'alt_m', targetHandle: 'a' },
        { id: 'e2', source: 'gear_alt', target: 'compare', sourceHandle: 'value', targetHandle: 'b' },
        // Compare → Branch
        { id: 'e3', source: 'compare', target: 'branch', sourceHandle: 'result', targetHandle: 'condition' },
        // TRUE → Retract
        { id: 'e4', source: 'branch', target: 'retract', sourceHandle: 'true_out', targetHandle: 'trigger' },
        { id: 'e5', source: 'retract_pwm', target: 'retract', sourceHandle: 'value', targetHandle: 'pwm' },
        // FALSE → Deploy
        { id: 'e6', source: 'branch', target: 'deploy', sourceHandle: 'false_out', targetHandle: 'trigger' },
        { id: 'e7', source: 'deploy_pwm', target: 'deploy', sourceHandle: 'value', targetHandle: 'pwm' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.8 },
    },
  },

  // ─── Camera Trigger ───────────────────────────────────────────
  {
    id: 'camera-trigger',
    name: 'Camera Trigger',
    get description() { return t('lua_graph.graph_templates.triggerCameraRelayAtAFixed'); },
    category: 'Automation',
    graph: {
      version: 1,
      name: 'Camera Trigger',
      get description() { return t('lua_graph.graph_templates.triggerCameraRelayAtTimeIntervals'); },
      runIntervalMs: 500,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Annotations ──
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.checkIfTheVehicleIsMoving'); } },
          },
        },
        {
          id: 'comment_gate',
          type: 'flow-comment',
          position: { x: 380, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.onlyTriggerWhileSpeedMinimum'); } },
          },
        },
        {
          id: 'comment_timer',
          type: 'flow-comment',
          position: { x: 690, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.rateLimitTheShutterTrigger'); } },
          },
        },
        {
          id: 'comment_fire',
          type: 'flow-comment',
          position: { x: 1000, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step4'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.activateCameraRelay'); } },
          },
        },
        // ── Data flow ──
        {
          id: 'speed',
          type: 'sensor-groundspeed',
          position: { x: 60, y: 110 },
          data: {
            definitionType: 'sensor-groundspeed',
            get label() { return t('lua_graph.graph_templates.groundSpeed'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'min_speed',
          type: 'var-constant',
          position: { x: 160, y: 270 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.minSpeedMS'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '1' },
          },
        },
        {
          id: 'moving_check',
          type: 'logic-compare',
          position: { x: 400, y: 115 },
          data: {
            definitionType: 'logic-compare',
            get label() { return t('lua_graph.graph_templates.moving'); },
            category: 'logic',
            propertyValues: { operator: '>' },
          },
        },
        {
          id: 'timer',
          type: 'timing-run-every',
          position: { x: 710, y: 120 },
          data: {
            definitionType: 'timing-run-every',
            get label() { return t('lua_graph.graph_templates.every5Sec'); },
            category: 'timing',
            propertyValues: { interval_ms: 5000 },
          },
        },
        {
          id: 'shutter',
          type: 'action-relay',
          position: { x: 1020, y: 120 },
          data: {
            definitionType: 'action-relay',
            get label() { return t('lua_graph.graph_templates.cameraShutter'); },
            category: 'actions',
            propertyValues: { relay_num: 0, state: 1 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'speed', target: 'moving_check', sourceHandle: 'speed_ms', targetHandle: 'a' },
        { id: 'e2', source: 'min_speed', target: 'moving_check', sourceHandle: 'value', targetHandle: 'b' },
        { id: 'e3', source: 'moving_check', target: 'timer', sourceHandle: 'result', targetHandle: 'trigger' },
        { id: 'e4', source: 'timer', target: 'shutter', sourceHandle: 'flow', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.8 },
    },
  },

  // ─── Terrain Follow ───────────────────────────────────────────
  {
    id: 'terrain-follow',
    name: 'Terrain Follow',
    get description() { return t('lua_graph.graph_templates.warnWhenRangefinderReadingIsOutside'); },
    category: 'Navigation',
    graph: {
      version: 1,
      name: 'Terrain Follow',
      get description() { return t('lua_graph.graph_templates.monitorRangefinderForSafeTerrainFollowing'); },
      runIntervalMs: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Annotations ──
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 40, y: 30 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readDistanceToGroundFromRangefinder'); } },
          },
        },
        {
          id: 'comment_check',
          type: 'flow-comment',
          position: { x: 370, y: 30 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.isAltitudeWithinSafe350m'); } },
          },
        },
        {
          id: 'comment_invert',
          type: 'flow-comment',
          position: { x: 670, y: 30 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.invertTriggerWhenOutOfRange'); } },
          },
        },
        {
          id: 'comment_warn',
          type: 'flow-comment',
          position: { x: 940, y: 30 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step4'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.sendUrgentTerrainWarning'); } },
          },
        },
        // ── Data flow ──
        {
          id: 'rangefinder',
          type: 'sensor-rangefinder',
          position: { x: 60, y: 120 },
          data: {
            definitionType: 'sensor-rangefinder',
            get label() { return t('lua_graph.graph_templates.rangefinder'); },
            category: 'sensors',
            propertyValues: { instance: 0 },
          },
        },
        {
          id: 'range_check',
          type: 'logic-range-check',
          position: { x: 390, y: 120 },
          data: {
            definitionType: 'logic-range-check',
            get label() { return t('lua_graph.graph_templates.safeRange'); },
            category: 'logic',
            propertyValues: { min: 3, max: 50 },
          },
        },
        {
          id: 'invert',
          type: 'logic-not',
          position: { x: 690, y: 130 },
          data: {
            definitionType: 'logic-not',
            get label() { return t('lua_graph.graph_templates.outOfRange'); },
            category: 'logic',
            propertyValues: {},
          },
        },
        {
          id: 'warning',
          type: 'action-gcs-text',
          position: { x: 960, y: 130 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.terrainWarning'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.terrainRangefinderOutOfSafeRange'); }, severity: 4 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'rangefinder', target: 'range_check', sourceHandle: 'distance_m', targetHandle: 'value' },
        { id: 'e2', source: 'range_check', target: 'invert', sourceHandle: 'in_range', targetHandle: 'input' },
        { id: 'e3', source: 'invert', target: 'warning', sourceHandle: 'result', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  },

  // ─── Depth Logger ────────────────────────────────────────────
  {
    id: 'depth-logger',
    name: 'Depth Logger',
    get description() { return t('lua_graph.graph_templates.logRangefinderDepthGpsPositionTo'); },
    category: 'Data Logging',
    graph: {
      version: 1,
      name: 'Depth Logger',
      get description() { return t('lua_graph.graph_templates.logRangefinderDepthAndGpsPosition'); },
      runIntervalMs: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Annotations ──
        {
          id: 'comment_trigger',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.trigger'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.detectWhenThePilotFlipsThe'); } },
          },
        },
        {
          id: 'comment_sensors',
          type: 'flow-comment',
          position: { x: 430, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.readSensors'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.grabDepthFromRangefinderAndGps'); } },
          },
        },
        {
          id: 'comment_log',
          type: 'flow-comment',
          position: { x: 810, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.logNotify'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.writeToFileAndNotifyPilot'); } },
          },
        },
        // ── Trigger chain ──
        {
          id: 'aux_switch',
          type: 'sensor-rc-aux-switch',
          position: { x: 60, y: 110 },
          data: {
            definitionType: 'sensor-rc-aux-switch',
            get label() { return t('lua_graph.graph_templates.depthSwitch'); },
            category: 'sensors',
            propertyValues: { aux_fn: 300 },
          },
        },
        {
          id: 'edge_detect',
          type: 'timing-rising-edge',
          position: { x: 260, y: 120 },
          data: {
            definitionType: 'timing-rising-edge',
            get label() { return t('lua_graph.graph_templates.switchFlipped'); },
            category: 'timing',
            propertyValues: {},
          },
        },
        // ── Sensor column ──
        {
          id: 'rangefinder',
          type: 'sensor-rangefinder-orient',
          position: { x: 450, y: 110 },
          data: {
            definitionType: 'sensor-rangefinder-orient',
            get label() { return t('lua_graph.graph_templates.depthSensor'); },
            category: 'sensors',
            propertyValues: { orientation: 25 },
          },
        },
        {
          id: 'gps',
          type: 'sensor-gps',
          position: { x: 450, y: 230 },
          data: {
            definitionType: 'sensor-gps',
            get label() { return t('lua_graph.graph_templates.gpsPosition'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        // ── Log & Notify ──
        {
          id: 'file_log',
          type: 'action-log-to-file',
          position: { x: 830, y: 100 },
          data: {
            definitionType: 'action-log-to-file',
            get label() { return t('lua_graph.graph_templates.writeCsv'); },
            category: 'actions',
            propertyValues: { filename: 'depth_log.csv', separator: ';' },
          },
        },
        {
          id: 'notify',
          type: 'action-gcs-text',
          position: { x: 830, y: 300 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.notifyPilot'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.depthMeasurementLogged'); }, severity: 6 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'aux_switch', target: 'edge_detect', sourceHandle: 'is_high', targetHandle: 'input' },
        { id: 'e2', source: 'edge_detect', target: 'file_log', sourceHandle: 'triggered', targetHandle: 'trigger' },
        { id: 'e3', source: 'rangefinder', target: 'file_log', sourceHandle: 'distance_m', targetHandle: 'value1' },
        { id: 'e4', source: 'gps', target: 'file_log', sourceHandle: 'lat', targetHandle: 'value2' },
        { id: 'e5', source: 'gps', target: 'file_log', sourceHandle: 'lng', targetHandle: 'value3' },
        { id: 'e6', source: 'edge_detect', target: 'notify', sourceHandle: 'triggered', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  },

  // ─── Auto RTL on Low Battery ─────────────────────────────────
  {
    id: 'auto-rtl-battery',
    name: 'Auto RTL on Low Battery',
    get description() { return t('lua_graph.graph_templates.automaticallySwitchToRtlFlightMode'); },
    category: 'Safety',
    graph: {
      version: 1,
      name: 'Auto RTL on Low Battery',
      get description() { return t('lua_graph.graph_templates.switchToRtlWhenBatteryIs'); },
      runIntervalMs: 1000,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.monitorBatteryRemainingPercentage'); } },
          },
        },
        {
          id: 'comment_decide',
          type: 'flow-comment',
          position: { x: 400, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.isBatteryBelowCriticalLevel'); } },
          },
        },
        {
          id: 'comment_act',
          type: 'flow-comment',
          position: { x: 740, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.forceReturnToLaunchAndWarn'); } },
          },
        },
        {
          id: 'battery',
          type: 'sensor-battery',
          position: { x: 60, y: 100 },
          data: {
            definitionType: 'sensor-battery',
            get label() { return t('lua_graph.graph_templates.battery'); },
            category: 'sensors',
            propertyValues: { instance: 0 },
          },
        },
        {
          id: 'threshold',
          type: 'var-constant',
          position: { x: 200, y: 280 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.critical20'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '20' },
          },
        },
        {
          id: 'compare',
          type: 'logic-compare',
          position: { x: 420, y: 110 },
          data: {
            definitionType: 'logic-compare',
            get label() { return t('lua_graph.graph_templates.below20'); },
            category: 'logic',
            propertyValues: { operator: '<' },
          },
        },
        {
          id: 'debounce',
          type: 'timing-debounce',
          position: { x: 620, y: 115 },
          data: {
            definitionType: 'timing-debounce',
            get label() { return t('lua_graph.graph_templates.debounce3s'); },
            category: 'timing',
            propertyValues: { delay_ms: 3000 },
          },
        },
        {
          id: 'set_rtl',
          type: 'action-set-mode',
          position: { x: 830, y: 100 },
          data: {
            definitionType: 'action-set-mode',
            get label() { return t('lua_graph.graph_templates.setRtlMode'); },
            category: 'actions',
            propertyValues: { mode_num: 11 },
          },
        },
        {
          id: 'warn',
          type: 'action-gcs-text',
          position: { x: 830, y: 230 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.criticalWarning'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.criticalBatteryLowRtlActivated'); }, severity: 2 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'battery', target: 'compare', sourceHandle: 'remaining_pct', targetHandle: 'a' },
        { id: 'e2', source: 'threshold', target: 'compare', sourceHandle: 'value', targetHandle: 'b' },
        { id: 'e3', source: 'compare', target: 'debounce', sourceHandle: 'result', targetHandle: 'input' },
        { id: 'e4', source: 'debounce', target: 'set_rtl', sourceHandle: 'output', targetHandle: 'trigger' },
        { id: 'e5', source: 'debounce', target: 'warn', sourceHandle: 'output', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  },

  // ─── Payload Drop ────────────────────────────────────────────
  {
    id: 'payload-drop',
    name: 'Payload Drop',
    get description() { return t('lua_graph.graph_templates.releaseAServoActuatedPayloadWhen'); },
    category: 'Automation',
    graph: {
      version: 1,
      name: 'Payload Drop',
      get description() { return t('lua_graph.graph_templates.servoActuatedPayloadReleaseViaRc'); },
      runIntervalMs: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_trigger',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.trigger'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.pilotFlipsAuxSwitchToRelease'); } },
          },
        },
        {
          id: 'comment_branch',
          type: 'flow-comment',
          position: { x: 400, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.branch'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.switchHighReleaseLowHold'); } },
          },
        },
        {
          id: 'comment_action',
          type: 'flow-comment',
          position: { x: 730, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.actuate'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.moveServoToReleaseOrHold'); } },
          },
        },
        {
          id: 'aux_switch',
          type: 'sensor-rc-aux-switch',
          position: { x: 60, y: 110 },
          data: {
            definitionType: 'sensor-rc-aux-switch',
            get label() { return t('lua_graph.graph_templates.dropSwitch'); },
            category: 'sensors',
            propertyValues: { aux_fn: 301 },
          },
        },
        {
          id: 'branch',
          type: 'logic-if-else',
          position: { x: 420, y: 120 },
          data: {
            definitionType: 'logic-if-else',
            get label() { return t('lua_graph.graph_templates.switchHigh'); },
            category: 'logic',
            propertyValues: {},
          },
        },
        // TRUE path — release
        {
          id: 'release_pwm',
          type: 'var-constant',
          position: { x: 600, y: 40 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.releasePwm'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '1100' },
          },
        },
        {
          id: 'release_servo',
          type: 'action-set-servo',
          position: { x: 750, y: 100 },
          data: {
            definitionType: 'action-set-servo',
            get label() { return t('lua_graph.graph_templates.releasePayload'); },
            category: 'actions',
            propertyValues: { servo_num: 10 },
          },
        },
        {
          id: 'release_msg',
          type: 'action-gcs-text',
          position: { x: 980, y: 105 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.dropConfirmed'); },
            category: 'actions',
            propertyValues: { message: 'PAYLOAD RELEASED', severity: 5 },
          },
        },
        // FALSE path — hold
        {
          id: 'hold_pwm',
          type: 'var-constant',
          position: { x: 600, y: 280 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.holdPwm'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '1900' },
          },
        },
        {
          id: 'hold_servo',
          type: 'action-set-servo',
          position: { x: 750, y: 310 },
          data: {
            definitionType: 'action-set-servo',
            get label() { return t('lua_graph.graph_templates.holdPayload'); },
            category: 'actions',
            propertyValues: { servo_num: 10 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'aux_switch', target: 'branch', sourceHandle: 'is_high', targetHandle: 'condition' },
        // TRUE → release
        { id: 'e2', source: 'branch', target: 'release_servo', sourceHandle: 'true_out', targetHandle: 'trigger' },
        { id: 'e3', source: 'release_pwm', target: 'release_servo', sourceHandle: 'value', targetHandle: 'pwm' },
        { id: 'e4', source: 'branch', target: 'release_msg', sourceHandle: 'true_out', targetHandle: 'trigger' },
        // FALSE → hold
        { id: 'e5', source: 'branch', target: 'hold_servo', sourceHandle: 'false_out', targetHandle: 'trigger' },
        { id: 'e6', source: 'hold_pwm', target: 'hold_servo', sourceHandle: 'value', targetHandle: 'pwm' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  },

  // ─── Speed Limit Warning ─────────────────────────────────────
  {
    id: 'speed-limit-warning',
    name: 'Speed Limit Warning',
    get description() { return t('lua_graph.graph_templates.sendPeriodicGcsWarningsWhenGround'); },
    category: 'Safety',
    graph: {
      version: 1,
      name: 'Speed Limit Warning',
      get description() { return t('lua_graph.graph_templates.warnPilotWhenGroundSpeedExceeds'); },
      runIntervalMs: 500,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readCurrentGroundSpeed'); } },
          },
        },
        {
          id: 'comment_check',
          type: 'flow-comment',
          position: { x: 380, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.compareAgainstSpeedLimit'); } },
          },
        },
        {
          id: 'comment_warn',
          type: 'flow-comment',
          position: { x: 700, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.rateLimitedWarningToGcs'); } },
          },
        },
        {
          id: 'speed',
          type: 'sensor-groundspeed',
          position: { x: 60, y: 110 },
          data: {
            definitionType: 'sensor-groundspeed',
            get label() { return t('lua_graph.graph_templates.groundSpeed'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'limit',
          type: 'var-constant',
          position: { x: 160, y: 270 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.speedLimitMS'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '25' },
          },
        },
        {
          id: 'compare',
          type: 'logic-compare',
          position: { x: 400, y: 115 },
          data: {
            definitionType: 'logic-compare',
            get label() { return t('lua_graph.graph_templates.overLimit'); },
            category: 'logic',
            propertyValues: { operator: '>' },
          },
        },
        {
          id: 'rate_limit',
          type: 'timing-run-every',
          position: { x: 600, y: 120 },
          data: {
            definitionType: 'timing-run-every',
            get label() { return t('lua_graph.graph_templates.every5s'); },
            category: 'timing',
            propertyValues: { interval_ms: 5000 },
          },
        },
        {
          id: 'warning',
          type: 'action-gcs-text',
          position: { x: 820, y: 120 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.speedWarning'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.warningSpeedLimitExceeded'); }, severity: 4 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'speed', target: 'compare', sourceHandle: 'speed_ms', targetHandle: 'a' },
        { id: 'e2', source: 'limit', target: 'compare', sourceHandle: 'value', targetHandle: 'b' },
        { id: 'e3', source: 'compare', target: 'rate_limit', sourceHandle: 'result', targetHandle: 'trigger' },
        { id: 'e4', source: 'rate_limit', target: 'warning', sourceHandle: 'flow', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  },

  // ─── Flight Data Logger ──────────────────────────────────────
  {
    id: 'flight-data-logger',
    name: 'Flight Data Logger',
    get description() { return t('lua_graph.graph_templates.periodicallyLogGpsPositionAltitudeAnd'); },
    category: 'Data Logging',
    graph: {
      version: 1,
      name: 'Flight Data Logger',
      get description() { return t('lua_graph.graph_templates.periodicGpsAltitudeSpeedLoggingTo'); },
      runIntervalMs: 500,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_timer',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.timing'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.logADataPointEvery2'); } },
          },
        },
        {
          id: 'comment_data',
          type: 'flow-comment',
          position: { x: 370, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.dataSources'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readGpsAltitudeAndSpeed'); } },
          },
        },
        {
          id: 'comment_log',
          type: 'flow-comment',
          position: { x: 740, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.storage'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.appendToCsvFileOnSd'); } },
          },
        },
        {
          id: 'timer',
          type: 'timing-run-every',
          position: { x: 60, y: 120 },
          data: {
            definitionType: 'timing-run-every',
            get label() { return t('lua_graph.graph_templates.every2s'); },
            category: 'timing',
            propertyValues: { interval_ms: 2000 },
          },
        },
        {
          id: 'gps',
          type: 'sensor-gps',
          position: { x: 390, y: 110 },
          data: {
            definitionType: 'sensor-gps',
            get label() { return t('lua_graph.graph_templates.gpsPosition'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'speed',
          type: 'sensor-groundspeed',
          position: { x: 390, y: 260 },
          data: {
            definitionType: 'sensor-groundspeed',
            get label() { return t('lua_graph.graph_templates.groundSpeed'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'log_gps',
          type: 'action-log-to-file',
          position: { x: 760, y: 110 },
          data: {
            definitionType: 'action-log-to-file',
            get label() { return t('lua_graph.graph_templates.logPosition'); },
            category: 'actions',
            propertyValues: { filename: 'flight_log.csv', separator: ',' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'timer', target: 'log_gps', sourceHandle: 'flow', targetHandle: 'trigger' },
        { id: 'e2', source: 'gps', target: 'log_gps', sourceHandle: 'lat', targetHandle: 'value1' },
        { id: 'e3', source: 'gps', target: 'log_gps', sourceHandle: 'lng', targetHandle: 'value2' },
        { id: 'e4', source: 'speed', target: 'log_gps', sourceHandle: 'speed_ms', targetHandle: 'value3' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  },

  // ─── Wind Speed Failsafe ─────────────────────────────────────
  // Inspired by: ArduPilot plane-wind-failsafe.lua
  {
    id: 'wind-speed-failsafe',
    name: 'Wind Speed Failsafe',
    get description() { return t('lua_graph.graph_templates.warnWhenWindExceedsAThreshold'); },
    category: 'Safety',
    graph: {
      version: 1,
      name: 'Wind Speed Failsafe',
      get description() { return t('lua_graph.graph_templates.windSpeedWarningRtlFailsafeFor'); },
      runIntervalMs: 1000,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.sense'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readEstimatedWindSpeed'); } },
          },
        },
        {
          id: 'comment_warn',
          type: 'flow-comment',
          position: { x: 380, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.warning'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.warnPilotAt10MS'); } },
          },
        },
        {
          id: 'comment_failsafe',
          type: 'flow-comment',
          position: { x: 380, y: 250 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.failsafe'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.forceRtlAt15MS'); } },
          },
        },
        {
          id: 'wind',
          type: 'sensor-wind',
          position: { x: 60, y: 120 },
          data: {
            definitionType: 'sensor-wind',
            get label() { return t('lua_graph.graph_templates.windEstimate'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'warn_threshold',
          type: 'var-constant',
          position: { x: 200, y: 200 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.warnMS'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '10' },
          },
        },
        {
          id: 'warn_compare',
          type: 'logic-compare',
          position: { x: 400, y: 110 },
          data: {
            definitionType: 'logic-compare',
            get label() { return t('lua_graph.graph_templates.wind10'); },
            category: 'logic',
            propertyValues: { operator: '>' },
          },
        },
        {
          id: 'warn_msg',
          type: 'action-gcs-text',
          position: { x: 680, y: 100 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.windWarning'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.windWarningSpeedExceedingLimit'); }, severity: 4 },
          },
        },
        {
          id: 'fs_threshold',
          type: 'var-constant',
          position: { x: 200, y: 410 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.failsafeMS'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '15' },
          },
        },
        {
          id: 'fs_compare',
          type: 'logic-compare',
          position: { x: 400, y: 330 },
          data: {
            definitionType: 'logic-compare',
            get label() { return t('lua_graph.graph_templates.wind15'); },
            category: 'logic',
            propertyValues: { operator: '>' },
          },
        },
        {
          id: 'fs_debounce',
          type: 'timing-debounce',
          position: { x: 600, y: 330 },
          data: {
            definitionType: 'timing-debounce',
            get label() { return t('lua_graph.graph_templates.debounce5s'); },
            category: 'timing',
            propertyValues: { delay_ms: 5000 },
          },
        },
        {
          id: 'set_rtl',
          type: 'action-set-mode',
          position: { x: 830, y: 310 },
          data: {
            definitionType: 'action-set-mode',
            get label() { return t('lua_graph.graph_templates.setRtl'); },
            category: 'actions',
            propertyValues: { mode_num: 11 },
          },
        },
        {
          id: 'fs_msg',
          type: 'action-gcs-text',
          position: { x: 830, y: 430 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.windFailsafe'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.windFailsafeRtlActivated'); }, severity: 0 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'wind', target: 'warn_compare', sourceHandle: 'speed_ms', targetHandle: 'a' },
        { id: 'e2', source: 'warn_threshold', target: 'warn_compare', sourceHandle: 'value', targetHandle: 'b' },
        { id: 'e3', source: 'warn_compare', target: 'warn_msg', sourceHandle: 'result', targetHandle: 'trigger' },
        { id: 'e4', source: 'wind', target: 'fs_compare', sourceHandle: 'speed_ms', targetHandle: 'a' },
        { id: 'e5', source: 'fs_threshold', target: 'fs_compare', sourceHandle: 'value', targetHandle: 'b' },
        { id: 'e6', source: 'fs_compare', target: 'fs_debounce', sourceHandle: 'result', targetHandle: 'input' },
        { id: 'e7', source: 'fs_debounce', target: 'set_rtl', sourceHandle: 'output', targetHandle: 'trigger' },
        { id: 'e8', source: 'fs_debounce', target: 'fs_msg', sourceHandle: 'output', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.8 },
    },
  },

  // ─── Camera on Arm ─────────────────────────────────────────
  // Inspired by: ArduPilot runcam_on_arm.lua
  {
    id: 'camera-on-arm',
    name: 'Camera on Arm/Disarm',
    get description() { return t('lua_graph.graph_templates.notifyWhenVehicleArmsOrDisarms'); },
    category: 'Automation',
    graph: {
      version: 1,
      name: 'Camera on Arm/Disarm',
      get description() { return t('lua_graph.graph_templates.notifyOnArmDisarmTransitionsWith'); },
      runIntervalMs: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.monitorArmDisarmState'); } },
          },
        },
        {
          id: 'comment_detect',
          type: 'flow-comment',
          position: { x: 340, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.detectArmAndDisarmTransitions'); } },
          },
        },
        {
          id: 'comment_act',
          type: 'flow-comment',
          position: { x: 680, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.alertPilotAndPlayTunes'); } },
          },
        },
        {
          id: 'armed',
          type: 'sensor-armed',
          position: { x: 60, y: 130 },
          data: {
            definitionType: 'sensor-armed',
            get label() { return t('lua_graph.graph_templates.armedState'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'rising',
          type: 'timing-rising-edge',
          position: { x: 340, y: 100 },
          data: {
            definitionType: 'timing-rising-edge',
            get label() { return t('lua_graph.graph_templates.justArmed'); },
            category: 'timing',
            propertyValues: {},
          },
        },
        {
          id: 'falling',
          type: 'timing-falling-edge',
          position: { x: 340, y: 260 },
          data: {
            definitionType: 'timing-falling-edge',
            get label() { return t('lua_graph.graph_templates.justDisarmed'); },
            category: 'timing',
            propertyValues: {},
          },
        },
        {
          id: 'arm_msg',
          type: 'action-gcs-text',
          position: { x: 600, y: 80 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.armedAlert'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.cameraRecordingStarted'); }, severity: 6 },
          },
        },
        {
          id: 'arm_tune',
          type: 'action-play-tune',
          position: { x: 850, y: 80 },
          data: {
            definitionType: 'action-play-tune',
            get label() { return t('lua_graph.graph_templates.armBeep'); },
            category: 'actions',
            propertyValues: { tune: 'MFT200L4O5CEG' },
          },
        },
        {
          id: 'disarm_msg',
          type: 'action-gcs-text',
          position: { x: 600, y: 240 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.disarmedAlert'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.cameraRecordingStopped'); }, severity: 6 },
          },
        },
        {
          id: 'disarm_tune',
          type: 'action-play-tune',
          position: { x: 850, y: 240 },
          data: {
            definitionType: 'action-play-tune',
            get label() { return t('lua_graph.graph_templates.disarmBeep'); },
            category: 'actions',
            propertyValues: { tune: 'MFT200L4O5GEC' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'armed', target: 'rising', sourceHandle: 'is_armed', targetHandle: 'input' },
        { id: 'e2', source: 'armed', target: 'falling', sourceHandle: 'is_armed', targetHandle: 'input' },
        { id: 'e3', source: 'rising', target: 'arm_msg', sourceHandle: 'triggered', targetHandle: 'trigger' },
        { id: 'e4', source: 'rising', target: 'arm_tune', sourceHandle: 'triggered', targetHandle: 'trigger' },
        { id: 'e5', source: 'falling', target: 'disarm_msg', sourceHandle: 'triggered', targetHandle: 'trigger' },
        { id: 'e6', source: 'falling', target: 'disarm_tune', sourceHandle: 'triggered', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  },

  // ─── GPS Satellite Monitor ─────────────────────────────────
  {
    id: 'gps-satellite-monitor',
    name: 'GPS Satellite Monitor',
    get description() { return t('lua_graph.graph_templates.warnThePilotWithABuzzer'); },
    category: 'Safety',
    graph: {
      version: 1,
      name: 'GPS Satellite Monitor',
      get description() { return t('lua_graph.graph_templates.alertWhenGpsFixIsLost'); },
      runIntervalMs: 1000,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readGpsFixStatus'); } },
          },
        },
        {
          id: 'comment_check',
          type: 'flow-comment',
          position: { x: 370, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.onlyAlertWhenFixIsLost'); } },
          },
        },
        {
          id: 'comment_act',
          type: 'flow-comment',
          position: { x: 730, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.warnPilotWithMessageAndBuzzer'); } },
          },
        },
        {
          id: 'gps',
          type: 'sensor-gps-status',
          position: { x: 60, y: 100 },
          data: {
            definitionType: 'sensor-gps-status',
            get label() { return t('lua_graph.graph_templates.gpsStatus'); },
            category: 'sensors',
            propertyValues: { instance: 0 },
          },
        },
        {
          id: 'armed',
          type: 'sensor-armed',
          position: { x: 60, y: 280 },
          data: {
            definitionType: 'sensor-armed',
            get label() { return t('lua_graph.graph_templates.armed'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'no_fix',
          type: 'logic-not',
          position: { x: 320, y: 110 },
          data: {
            definitionType: 'logic-not',
            get label() { return t('lua_graph.graph_templates.no3dFix'); },
            category: 'logic',
            propertyValues: {},
          },
        },
        {
          id: 'gate',
          type: 'logic-and',
          position: { x: 520, y: 150 },
          data: {
            definitionType: 'logic-and',
            get label() { return t('lua_graph.graph_templates.armedNoFix'); },
            category: 'logic',
            propertyValues: {},
          },
        },
        {
          id: 'warn_msg',
          type: 'action-gcs-text',
          position: { x: 750, y: 100 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.gpsWarning'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.warningGps3dFixLost'); }, severity: 2 },
          },
        },
        {
          id: 'warn_tune',
          type: 'action-play-tune',
          position: { x: 750, y: 240 },
          data: {
            definitionType: 'action-play-tune',
            get label() { return t('lua_graph.graph_templates.alertBuzzer'); },
            category: 'actions',
            propertyValues: { tune: 'MFT100L8O5CDCD' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'gps', target: 'no_fix', sourceHandle: 'has_3d_fix', targetHandle: 'input' },
        { id: 'e2', source: 'no_fix', target: 'gate', sourceHandle: 'result', targetHandle: 'a' },
        { id: 'e3', source: 'armed', target: 'gate', sourceHandle: 'is_armed', targetHandle: 'b' },
        { id: 'e4', source: 'gate', target: 'warn_msg', sourceHandle: 'result', targetHandle: 'trigger' },
        { id: 'e5', source: 'gate', target: 'warn_tune', sourceHandle: 'result', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  },

  // ─── Flight Mode Logger ────────────────────────────────────
  {
    id: 'flight-mode-logger',
    name: 'Flight Mode Change Logger',
    get description() { return t('lua_graph.graph_templates.logEveryFlightModeChangeTo'); },
    category: 'Data Logging',
    graph: {
      version: 1,
      name: 'Flight Mode Change Logger',
      get description() { return t('lua_graph.graph_templates.trackAndLogAllFlightMode'); },
      runIntervalMs: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readTheCurrentFlightModeNumber'); } },
          },
        },
        {
          id: 'comment_detect',
          type: 'flow-comment',
          position: { x: 360, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.onlyActWhenTheModeChanges'); } },
          },
        },
        {
          id: 'comment_log',
          type: 'flow-comment',
          position: { x: 680, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.logToFileAndNotifyPilot'); } },
          },
        },
        {
          id: 'mode',
          type: 'sensor-flight-mode',
          position: { x: 60, y: 120 },
          data: {
            definitionType: 'sensor-flight-mode',
            get label() { return t('lua_graph.graph_templates.flightMode'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'on_change',
          type: 'timing-on-change',
          position: { x: 360, y: 125 },
          data: {
            definitionType: 'timing-on-change',
            get label() { return t('lua_graph.graph_templates.modeChanged2'); },
            category: 'timing',
            propertyValues: {},
          },
        },
        {
          id: 'gps',
          type: 'sensor-gps',
          position: { x: 360, y: 260 },
          data: {
            definitionType: 'sensor-gps',
            get label() { return t('lua_graph.graph_templates.gpsPosition'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'announce',
          type: 'action-gcs-text',
          position: { x: 700, y: 100 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.modeChanged'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.flightModeChanged'); }, severity: 6 },
          },
        },
        {
          id: 'log',
          type: 'action-log-to-file',
          position: { x: 700, y: 240 },
          data: {
            definitionType: 'action-log-to-file',
            get label() { return t('lua_graph.graph_templates.logModeChange'); },
            category: 'actions',
            propertyValues: { filename: 'mode_log.csv', separator: ',' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'mode', target: 'on_change', sourceHandle: 'mode_num', targetHandle: 'value' },
        { id: 'e2', source: 'on_change', target: 'announce', sourceHandle: 'changed', targetHandle: 'trigger' },
        { id: 'e3', source: 'on_change', target: 'log', sourceHandle: 'changed', targetHandle: 'trigger' },
        { id: 'e4', source: 'mode', target: 'log', sourceHandle: 'mode_num', targetHandle: 'value1' },
        { id: 'e5', source: 'gps', target: 'log', sourceHandle: 'lat', targetHandle: 'value2' },
        { id: 'e6', source: 'gps', target: 'log', sourceHandle: 'lng', targetHandle: 'value3' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  },

  // ─── LED Brightness Switch ─────────────────────────────────
  // Inspired by: ArduPilot leds_on_a_switch.lua
  {
    id: 'led-brightness-switch',
    name: 'LED Brightness Switch',
    get description() { return t('lua_graph.graph_templates.controlLedBrightnessWithA3'); },
    category: 'Automation',
    graph: {
      version: 1,
      name: 'LED Brightness Switch',
      get description() { return t('lua_graph.graph_templates.n3PositionAuxSwitchForLed'); },
      runIntervalMs: 500,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readAuxSwitchLowMidHigh'); } },
          },
        },
        {
          id: 'comment_route',
          type: 'flow-comment',
          position: { x: 380, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.routeToTheCorrectBrightnessLevel'); } },
          },
        },
        {
          id: 'comment_act',
          type: 'flow-comment',
          position: { x: 700, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.setNtfLedBrightParameter'); } },
          },
        },
        {
          id: 'aux_switch',
          type: 'sensor-rc-aux-switch',
          position: { x: 60, y: 120 },
          data: {
            definitionType: 'sensor-rc-aux-switch',
            get label() { return t('lua_graph.graph_templates.ledSwitch'); },
            category: 'sensors',
            propertyValues: { aux_fn: 300 },
          },
        },
        {
          id: 'val_off',
          type: 'var-constant',
          position: { x: 530, y: 80 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.off0'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '0' },
          },
        },
        {
          id: 'set_off',
          type: 'action-set-param',
          position: { x: 720, y: 80 },
          data: {
            definitionType: 'action-set-param',
            get label() { return t('lua_graph.graph_templates.ledsOff'); },
            category: 'actions',
            propertyValues: { param_name: 'NTF_LED_BRIGHT' },
          },
        },
        {
          id: 'val_dim',
          type: 'var-constant',
          position: { x: 530, y: 220 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.dim1'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '1' },
          },
        },
        {
          id: 'set_dim',
          type: 'action-set-param',
          position: { x: 720, y: 220 },
          data: {
            definitionType: 'action-set-param',
            get label() { return t('lua_graph.graph_templates.ledsDim'); },
            category: 'actions',
            propertyValues: { param_name: 'NTF_LED_BRIGHT' },
          },
        },
        {
          id: 'val_bright',
          type: 'var-constant',
          position: { x: 530, y: 360 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.bright3'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '3' },
          },
        },
        {
          id: 'set_bright',
          type: 'action-set-param',
          position: { x: 720, y: 360 },
          data: {
            definitionType: 'action-set-param',
            get label() { return t('lua_graph.graph_templates.ledsBright'); },
            category: 'actions',
            propertyValues: { param_name: 'NTF_LED_BRIGHT' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'aux_switch', target: 'set_off', sourceHandle: 'is_low', targetHandle: 'trigger' },
        { id: 'e2', source: 'val_off', target: 'set_off', sourceHandle: 'value', targetHandle: 'value' },
        { id: 'e3', source: 'aux_switch', target: 'set_dim', sourceHandle: 'is_mid', targetHandle: 'trigger' },
        { id: 'e4', source: 'val_dim', target: 'set_dim', sourceHandle: 'value', targetHandle: 'value' },
        { id: 'e5', source: 'aux_switch', target: 'set_bright', sourceHandle: 'is_high', targetHandle: 'trigger' },
        { id: 'e6', source: 'val_bright', target: 'set_bright', sourceHandle: 'value', targetHandle: 'value' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  },

  // ─── Aerial Survey Automation ────────────────────────────────
  // Complex: 19 functional nodes + 4 comments = 23 total
  {
    id: 'aerial-survey',
    name: 'Aerial Survey Automation',
    get description() { return t('lua_graph.graph_templates.autoTriggerCameraAtTimedIntervals'); },
    category: 'Automation',
    graph: {
      version: 1,
      name: 'Aerial Survey Automation',
      get description() { return t('lua_graph.graph_templates.cameraTriggerGpsLoggingForAutomated'); },
      runIntervalMs: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Stage comments ──
        {
          id: 'c1', type: 'flow-comment', position: { x: 40, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.sensors'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.readVehicleStateArmModeSpeed'); } } },
        },
        {
          id: 'c2', type: 'flow-comment', position: { x: 400, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.conditions'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.checkCorrectModeMovingAtSurvey'); } } },
        },
        {
          id: 'c3', type: 'flow-comment', position: { x: 800, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.gate'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.all4ConditionsMustPassBefore'); } } },
        },
        {
          id: 'c4', type: 'flow-comment', position: { x: 1200, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.actions'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.triggerCameraLogGpsAltNotify'); } } },
        },
        // ── Sensors ──
        {
          id: 'armed', type: 'sensor-armed', position: { x: 60, y: 120 },
          data: { definitionType: 'sensor-armed', get label() { return t('lua_graph.graph_templates.armedState'); }, category: 'sensors', propertyValues: {} },
        },
        {
          id: 'mode', type: 'sensor-flight-mode', position: { x: 60, y: 260 },
          data: { definitionType: 'sensor-flight-mode', get label() { return t('lua_graph.graph_templates.flightMode'); }, category: 'sensors', propertyValues: {} },
        },
        {
          id: 'speed', type: 'sensor-groundspeed', position: { x: 60, y: 400 },
          data: { definitionType: 'sensor-groundspeed', get label() { return t('lua_graph.graph_templates.groundSpeed'); }, category: 'sensors', propertyValues: {} },
        },
        {
          id: 'altitude', type: 'sensor-baro-alt', position: { x: 60, y: 540 },
          data: { definitionType: 'sensor-baro-alt', get label() { return t('lua_graph.graph_templates.altitude'); }, category: 'sensors', propertyValues: {} },
        },
        {
          id: 'gps', type: 'sensor-gps', position: { x: 60, y: 680 },
          data: { definitionType: 'sensor-gps', get label() { return t('lua_graph.graph_templates.gpsPosition'); }, category: 'sensors', propertyValues: {} },
        },
        // ── Constants ──
        {
          id: 'auto_mode_val', type: 'var-constant', position: { x: 240, y: 330 },
          data: { definitionType: 'var-constant', get label() { return t('lua_graph.graph_templates.autoMode10'); }, category: 'variables', propertyValues: { type: 'number', value: '10' } },
        },
        {
          id: 'min_speed_val', type: 'var-constant', position: { x: 240, y: 470 },
          data: { definitionType: 'var-constant', get label() { return t('lua_graph.graph_templates.minSpeedMS'); }, category: 'variables', propertyValues: { type: 'number', value: '2' } },
        },
        // ── Edge detect on arm ──
        {
          id: 'arm_edge', type: 'timing-rising-edge', position: { x: 420, y: 120 },
          data: { definitionType: 'timing-rising-edge', get label() { return t('lua_graph.graph_templates.justArmed'); }, category: 'timing', propertyValues: {} },
        },
        // ── Logic checks ──
        {
          id: 'mode_check', type: 'logic-compare', position: { x: 420, y: 260 },
          data: { definitionType: 'logic-compare', get label() { return t('lua_graph.graph_templates.inAuto'); }, category: 'logic', propertyValues: { operator: '==' } },
        },
        {
          id: 'speed_check', type: 'logic-compare', position: { x: 420, y: 400 },
          data: { definitionType: 'logic-compare', get label() { return t('lua_graph.graph_templates.moving'); }, category: 'logic', propertyValues: { operator: '>' } },
        },
        {
          id: 'alt_check', type: 'logic-range-check', position: { x: 420, y: 540 },
          data: { definitionType: 'logic-range-check', get label() { return t('lua_graph.graph_templates.atSurveyAlt'); }, category: 'logic', propertyValues: { min: 30, max: 120 } },
        },
        // ── AND gates (chain 4 conditions) ──
        {
          id: 'gate1', type: 'logic-and', position: { x: 680, y: 180 },
          data: { definitionType: 'logic-and', get label() { return t('lua_graph.graph_templates.armedAuto'); }, category: 'logic', propertyValues: {} },
        },
        {
          id: 'gate2', type: 'logic-and', position: { x: 680, y: 440 },
          data: { definitionType: 'logic-and', get label() { return t('lua_graph.graph_templates.movingAltOk'); }, category: 'logic', propertyValues: {} },
        },
        {
          id: 'gate3', type: 'logic-and', position: { x: 900, y: 300 },
          data: { definitionType: 'logic-and', get label() { return t('lua_graph.graph_templates.allConditions'); }, category: 'logic', propertyValues: {} },
        },
        // ── Camera timer ──
        {
          id: 'camera_timer', type: 'timing-run-every', position: { x: 1100, y: 300 },
          data: { definitionType: 'timing-run-every', get label() { return t('lua_graph.graph_templates.every3Sec'); }, category: 'timing', propertyValues: { interval_ms: 3000 } },
        },
        // ── Actions ──
        {
          id: 'start_msg', type: 'action-gcs-text', position: { x: 680, y: 80 },
          data: { definitionType: 'action-gcs-text', get label() { return t('lua_graph.graph_templates.surveyReady'); }, category: 'actions', propertyValues: { get message() { return t('lua_graph.graph_templates.surveyModeActiveCameraArmed'); }, severity: 5 } },
        },
        {
          id: 'camera_relay', type: 'action-relay', position: { x: 1300, y: 200 },
          data: { definitionType: 'action-relay', get label() { return t('lua_graph.graph_templates.cameraShutter'); }, category: 'actions', propertyValues: { relay_num: 0, state: 1 } },
        },
        {
          id: 'photo_msg', type: 'action-gcs-text', position: { x: 1300, y: 350 },
          data: { definitionType: 'action-gcs-text', get label() { return t('lua_graph.graph_templates.photoTaken'); }, category: 'actions', propertyValues: { get message() { return t('lua_graph.graph_templates.photoCaptured'); }, severity: 6 } },
        },
        {
          id: 'log_photo', type: 'action-log-to-file', position: { x: 1300, y: 500 },
          data: { definitionType: 'action-log-to-file', get label() { return t('lua_graph.graph_templates.logGpsAlt'); }, category: 'actions', propertyValues: { filename: 'survey_log.csv', separator: ',' } },
        },
      ],
      edges: [
        // Armed → edge detect + gate
        { id: 'e1', source: 'armed', target: 'arm_edge', sourceHandle: 'is_armed', targetHandle: 'input' },
        { id: 'e2', source: 'armed', target: 'gate1', sourceHandle: 'is_armed', targetHandle: 'a' },
        { id: 'e3', source: 'arm_edge', target: 'start_msg', sourceHandle: 'triggered', targetHandle: 'trigger' },
        // Mode check → gate1
        { id: 'e4', source: 'mode', target: 'mode_check', sourceHandle: 'mode_num', targetHandle: 'a' },
        { id: 'e5', source: 'auto_mode_val', target: 'mode_check', sourceHandle: 'value', targetHandle: 'b' },
        { id: 'e6', source: 'mode_check', target: 'gate1', sourceHandle: 'result', targetHandle: 'b' },
        // Speed check → gate2
        { id: 'e7', source: 'speed', target: 'speed_check', sourceHandle: 'speed_ms', targetHandle: 'a' },
        { id: 'e8', source: 'min_speed_val', target: 'speed_check', sourceHandle: 'value', targetHandle: 'b' },
        { id: 'e9', source: 'speed_check', target: 'gate2', sourceHandle: 'result', targetHandle: 'a' },
        // Alt check → gate2
        { id: 'e10', source: 'altitude', target: 'alt_check', sourceHandle: 'alt_m', targetHandle: 'value' },
        { id: 'e11', source: 'alt_check', target: 'gate2', sourceHandle: 'in_range', targetHandle: 'b' },
        // Gates → master → timer
        { id: 'e12', source: 'gate1', target: 'gate3', sourceHandle: 'result', targetHandle: 'a' },
        { id: 'e13', source: 'gate2', target: 'gate3', sourceHandle: 'result', targetHandle: 'b' },
        { id: 'e14', source: 'gate3', target: 'camera_timer', sourceHandle: 'result', targetHandle: 'trigger' },
        // Timer → actions
        { id: 'e15', source: 'camera_timer', target: 'camera_relay', sourceHandle: 'flow', targetHandle: 'trigger' },
        { id: 'e16', source: 'camera_timer', target: 'photo_msg', sourceHandle: 'flow', targetHandle: 'trigger' },
        { id: 'e17', source: 'camera_timer', target: 'log_photo', sourceHandle: 'flow', targetHandle: 'trigger' },
        // GPS + altitude data → log
        { id: 'e18', source: 'gps', target: 'log_photo', sourceHandle: 'lat', targetHandle: 'value1' },
        { id: 'e19', source: 'gps', target: 'log_photo', sourceHandle: 'lng', targetHandle: 'value2' },
        { id: 'e20', source: 'altitude', target: 'log_photo', sourceHandle: 'alt_m', targetHandle: 'value3' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.65 },
    },
  },

  // ─── Gimbal Stabilizer ───────────────────────────────────────
  // Complex: 16 functional nodes + 4 comments = 20 total
  {
    id: 'gimbal-stabilizer',
    name: 'Gimbal Stabilizer',
    get description() { return t('lua_graph.graph_templates.twoAxisCameraGimbalStabilizationUsing'); },
    category: 'Configuration',
    graph: {
      version: 1,
      name: 'Gimbal Stabilizer',
      get description() { return t('lua_graph.graph_templates.twoAxisServoGimbalWithRc'); },
      runIntervalMs: 50,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Stage comments ──
        {
          id: 'c1', type: 'flow-comment', position: { x: 40, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.rcInputs'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.readRcGimbalSticksVehicleAttitude'); } } },
        },
        {
          id: 'c2', type: 'flow-comment', position: { x: 280, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.normalize'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.mapRcPwm10002000To'); } } },
        },
        {
          id: 'c3', type: 'flow-comment', position: { x: 520, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.stabilize'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.subtractVehicleTiltForStabilization'); } } },
        },
        {
          id: 'c4', type: 'flow-comment', position: { x: 960, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.output'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.clampConvertToPwmDriveServos'); } } },
        },
        // ── Sensors ──
        {
          id: 'rc_tilt', type: 'sensor-rc-channel', position: { x: 60, y: 120 },
          data: { definitionType: 'sensor-rc-channel', get label() { return t('lua_graph.graph_templates.tiltStickCh6'); }, category: 'sensors', propertyValues: { channel: 6 } },
        },
        {
          id: 'rc_pan', type: 'sensor-rc-channel', position: { x: 60, y: 280 },
          data: { definitionType: 'sensor-rc-channel', get label() { return t('lua_graph.graph_templates.panStickCh7'); }, category: 'sensors', propertyValues: { channel: 7 } },
        },
        {
          id: 'attitude', type: 'sensor-attitude', position: { x: 60, y: 440 },
          data: { definitionType: 'sensor-attitude', get label() { return t('lua_graph.graph_templates.vehicleAttitude'); }, category: 'sensors', propertyValues: {} },
        },
        {
          id: 'aux', type: 'sensor-rc-aux-switch', position: { x: 60, y: 620 },
          data: { definitionType: 'sensor-rc-aux-switch', get label() { return t('lua_graph.graph_templates.stabilizeSwitch'); }, category: 'sensors', propertyValues: { aux_fn: 300 } },
        },
        // ── Map RC to angle ──
        {
          id: 'map_tilt', type: 'math-map-range', position: { x: 300, y: 120 },
          data: { definitionType: 'math-map-range', get label() { return t('lua_graph.graph_templates.rcToTiltAngle'); }, category: 'math', propertyValues: { in_min: 1000, in_max: 2000, out_min: -45, out_max: 45 } },
        },
        {
          id: 'map_pan', type: 'math-map-range', position: { x: 300, y: 280 },
          data: { definitionType: 'math-map-range', get label() { return t('lua_graph.graph_templates.rcToPanAngle'); }, category: 'math', propertyValues: { in_min: 1000, in_max: 2000, out_min: -45, out_max: 45 } },
        },
        // ── Subtract attitude (stabilization) ──
        {
          id: 'stab_tilt', type: 'math-subtract', position: { x: 540, y: 160 },
          data: { definitionType: 'math-subtract', get label() { return t('lua_graph.graph_templates.tiltPitch'); }, category: 'math', propertyValues: {} },
        },
        {
          id: 'stab_pan', type: 'math-subtract', position: { x: 540, y: 320 },
          data: { definitionType: 'math-subtract', get label() { return t('lua_graph.graph_templates.panRoll'); }, category: 'math', propertyValues: {} },
        },
        // ── Clamp to safe travel ──
        {
          id: 'clamp_tilt', type: 'math-clamp', position: { x: 760, y: 160 },
          data: { definitionType: 'math-clamp', get label() { return t('lua_graph.graph_templates.clampTilt'); }, category: 'math', propertyValues: { min: -60, max: 60 } },
        },
        {
          id: 'clamp_pan', type: 'math-clamp', position: { x: 760, y: 320 },
          data: { definitionType: 'math-clamp', get label() { return t('lua_graph.graph_templates.clampPan'); }, category: 'math', propertyValues: { min: -60, max: 60 } },
        },
        // ── Map angle to servo PWM ──
        {
          id: 'tilt_pwm', type: 'math-map-range', position: { x: 980, y: 160 },
          data: { definitionType: 'math-map-range', get label() { return t('lua_graph.graph_templates.tiltToPwm'); }, category: 'math', propertyValues: { in_min: -60, in_max: 60, out_min: 1000, out_max: 2000 } },
        },
        {
          id: 'pan_pwm', type: 'math-map-range', position: { x: 980, y: 320 },
          data: { definitionType: 'math-map-range', get label() { return t('lua_graph.graph_templates.panToPwm'); }, category: 'math', propertyValues: { in_min: -60, in_max: 60, out_min: 1000, out_max: 2000 } },
        },
        // ── Servo outputs ──
        {
          id: 'servo_tilt', type: 'action-set-servo', position: { x: 1220, y: 160 },
          data: { definitionType: 'action-set-servo', get label() { return t('lua_graph.graph_templates.tiltServoS7'); }, category: 'actions', propertyValues: { servo_num: 7 } },
        },
        {
          id: 'servo_pan', type: 'action-set-servo', position: { x: 1220, y: 320 },
          data: { definitionType: 'action-set-servo', get label() { return t('lua_graph.graph_templates.panServoS8'); }, category: 'actions', propertyValues: { servo_num: 8 } },
        },
        // ── Enable notification ──
        {
          id: 'aux_edge', type: 'timing-rising-edge', position: { x: 300, y: 620 },
          data: { definitionType: 'timing-rising-edge', get label() { return t('lua_graph.graph_templates.switchOn'); }, category: 'timing', propertyValues: {} },
        },
        {
          id: 'enable_msg', type: 'action-gcs-text', position: { x: 540, y: 620 },
          data: { definitionType: 'action-gcs-text', get label() { return t('lua_graph.graph_templates.stabEnabled'); }, category: 'actions', propertyValues: { get message() { return t('lua_graph.graph_templates.gimbalStabilizationEnabled'); }, severity: 6 } },
        },
      ],
      edges: [
        // RC → Map to angle
        { id: 'e1', source: 'rc_tilt', target: 'map_tilt', sourceHandle: 'value_us', targetHandle: 'value' },
        { id: 'e2', source: 'rc_pan', target: 'map_pan', sourceHandle: 'value_us', targetHandle: 'value' },
        // Map → Subtract (A = operator input, B = attitude to remove)
        { id: 'e3', source: 'map_tilt', target: 'stab_tilt', sourceHandle: 'result', targetHandle: 'a' },
        { id: 'e4', source: 'map_pan', target: 'stab_pan', sourceHandle: 'result', targetHandle: 'a' },
        { id: 'e5', source: 'attitude', target: 'stab_tilt', sourceHandle: 'pitch', targetHandle: 'b' },
        { id: 'e6', source: 'attitude', target: 'stab_pan', sourceHandle: 'roll', targetHandle: 'b' },
        // Subtract → Clamp
        { id: 'e7', source: 'stab_tilt', target: 'clamp_tilt', sourceHandle: 'result', targetHandle: 'value' },
        { id: 'e8', source: 'stab_pan', target: 'clamp_pan', sourceHandle: 'result', targetHandle: 'value' },
        // Clamp → PWM mapping
        { id: 'e9', source: 'clamp_tilt', target: 'tilt_pwm', sourceHandle: 'result', targetHandle: 'value' },
        { id: 'e10', source: 'clamp_pan', target: 'pan_pwm', sourceHandle: 'result', targetHandle: 'value' },
        // PWM → Servo
        { id: 'e11', source: 'tilt_pwm', target: 'servo_tilt', sourceHandle: 'result', targetHandle: 'pwm' },
        { id: 'e12', source: 'pan_pwm', target: 'servo_pan', sourceHandle: 'result', targetHandle: 'pwm' },
        // Aux switch enables both servos
        { id: 'e13', source: 'aux', target: 'servo_tilt', sourceHandle: 'is_high', targetHandle: 'trigger' },
        { id: 'e14', source: 'aux', target: 'servo_pan', sourceHandle: 'is_high', targetHandle: 'trigger' },
        // Aux → edge detect → GCS message
        { id: 'e15', source: 'aux', target: 'aux_edge', sourceHandle: 'is_high', targetHandle: 'input' },
        { id: 'e16', source: 'aux_edge', target: 'enable_msg', sourceHandle: 'triggered', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.7 },
    },
  },

  // ─── Attitude-Reactive LED Display ──────────────────────────
  // Complex: 16 functional nodes + 4 comments = 20 total
  {
    id: 'attitude-led-display',
    name: 'Attitude LED Display',
    get description() { return t('lua_graph.graph_templates.driveNeopixelLedColorsBasedOn'); },
    category: 'Creative',
    graph: {
      version: 1,
      name: 'Attitude LED Display',
      get description() { return t('lua_graph.graph_templates.rgbLedsReactDynamicallyToVehicle'); },
      runIntervalMs: 50,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Stage comments ──
        {
          id: 'c1', type: 'flow-comment', position: { x: 40, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.inputs'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.readAttitudeAnglesArmStateAnd'); } } },
        },
        {
          id: 'c2', type: 'flow-comment', position: { x: 280, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.process'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.absValueThenMapAnglesTo'); } } },
        },
        {
          id: 'c3', type: 'flow-comment', position: { x: 720, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.clamp'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.limitToValid0255For'); } } },
        },
        {
          id: 'c4', type: 'flow-comment', position: { x: 980, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.output'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.gateByArmedSwitchOutputTo'); } } },
        },
        // ── Sensors ──
        {
          id: 'attitude', type: 'sensor-attitude', position: { x: 60, y: 160 },
          data: { definitionType: 'sensor-attitude', get label() { return t('lua_graph.graph_templates.attitude'); }, category: 'sensors', propertyValues: {} },
        },
        {
          id: 'armed', type: 'sensor-armed', position: { x: 60, y: 420 },
          data: { definitionType: 'sensor-armed', get label() { return t('lua_graph.graph_templates.armed'); }, category: 'sensors', propertyValues: {} },
        },
        {
          id: 'aux', type: 'sensor-rc-aux-switch', position: { x: 60, y: 560 },
          data: { definitionType: 'sensor-rc-aux-switch', get label() { return t('lua_graph.graph_templates.ledSwitch'); }, category: 'sensors', propertyValues: { aux_fn: 300 } },
        },
        // ── Absolute value (roll and pitch can be negative) ──
        {
          id: 'abs_roll', type: 'math-abs', position: { x: 280, y: 120 },
          data: { definitionType: 'math-abs', label: '|Roll|', category: 'math', propertyValues: {} },
        },
        {
          id: 'abs_pitch', type: 'math-abs', position: { x: 280, y: 280 },
          data: { definitionType: 'math-abs', label: '|Pitch|', category: 'math', propertyValues: {} },
        },
        // ── Map to 0-255 color range ──
        {
          id: 'map_r', type: 'math-map-range', position: { x: 500, y: 120 },
          data: { definitionType: 'math-map-range', get label() { return t('lua_graph.graph_templates.rollToRed'); }, category: 'math', propertyValues: { in_min: 0, in_max: 45, out_min: 0, out_max: 255 } },
        },
        {
          id: 'map_g', type: 'math-map-range', position: { x: 500, y: 280 },
          data: { definitionType: 'math-map-range', get label() { return t('lua_graph.graph_templates.pitchToGreen'); }, category: 'math', propertyValues: { in_min: 0, in_max: 45, out_min: 0, out_max: 255 } },
        },
        {
          id: 'map_b', type: 'math-map-range', position: { x: 500, y: 440 },
          data: { definitionType: 'math-map-range', get label() { return t('lua_graph.graph_templates.yawToBlue'); }, category: 'math', propertyValues: { in_min: 0, in_max: 360, out_min: 0, out_max: 255 } },
        },
        // ── Clamp to valid 0-255 ──
        {
          id: 'clamp_r', type: 'math-clamp', position: { x: 740, y: 120 },
          data: { definitionType: 'math-clamp', get label() { return t('lua_graph.graph_templates.clampRed'); }, category: 'math', propertyValues: { min: 0, max: 255 } },
        },
        {
          id: 'clamp_g', type: 'math-clamp', position: { x: 740, y: 280 },
          data: { definitionType: 'math-clamp', get label() { return t('lua_graph.graph_templates.clampGreen'); }, category: 'math', propertyValues: { min: 0, max: 255 } },
        },
        {
          id: 'clamp_b', type: 'math-clamp', position: { x: 740, y: 440 },
          data: { definitionType: 'math-clamp', get label() { return t('lua_graph.graph_templates.clampBlue'); }, category: 'math', propertyValues: { min: 0, max: 255 } },
        },
        // ── Gate: armed + aux switch ──
        {
          id: 'gate', type: 'logic-and', position: { x: 780, y: 560 },
          data: { definitionType: 'logic-and', get label() { return t('lua_graph.graph_templates.armedEnabled'); }, category: 'logic', propertyValues: {} },
        },
        {
          id: 'timer', type: 'timing-run-every', position: { x: 990, y: 490 },
          data: { definitionType: 'timing-run-every', get label() { return t('lua_graph.graph_templates.every100ms'); }, category: 'timing', propertyValues: { interval_ms: 100 } },
        },
        // ── LED output ──
        {
          id: 'led', type: 'action-set-led', position: { x: 1020, y: 240 },
          data: { definitionType: 'action-set-led', get label() { return t('lua_graph.graph_templates.neopixelLed'); }, category: 'actions', propertyValues: { instance: 0 } },
        },
        // ── Enable notification ──
        {
          id: 'aux_edge', type: 'timing-rising-edge', position: { x: 300, y: 560 },
          data: { definitionType: 'timing-rising-edge', get label() { return t('lua_graph.graph_templates.switchOn'); }, category: 'timing', propertyValues: {} },
        },
        {
          id: 'enable_msg', type: 'action-gcs-text', position: { x: 540, y: 560 },
          data: { definitionType: 'action-gcs-text', get label() { return t('lua_graph.graph_templates.ledActive'); }, category: 'actions', propertyValues: { get message() { return t('lua_graph.graph_templates.attitudeLedDisplayActivated'); }, severity: 6 } },
        },
      ],
      edges: [
        // Attitude → Abs (roll/pitch can be negative)
        { id: 'e1', source: 'attitude', target: 'abs_roll', sourceHandle: 'roll', targetHandle: 'value' },
        { id: 'e2', source: 'attitude', target: 'abs_pitch', sourceHandle: 'pitch', targetHandle: 'value' },
        // Abs → Map to 0-255
        { id: 'e3', source: 'abs_roll', target: 'map_r', sourceHandle: 'result', targetHandle: 'value' },
        { id: 'e4', source: 'abs_pitch', target: 'map_g', sourceHandle: 'result', targetHandle: 'value' },
        // Yaw direct (already 0-360)
        { id: 'e5', source: 'attitude', target: 'map_b', sourceHandle: 'yaw', targetHandle: 'value' },
        // Map → Clamp
        { id: 'e6', source: 'map_r', target: 'clamp_r', sourceHandle: 'result', targetHandle: 'value' },
        { id: 'e7', source: 'map_g', target: 'clamp_g', sourceHandle: 'result', targetHandle: 'value' },
        { id: 'e8', source: 'map_b', target: 'clamp_b', sourceHandle: 'result', targetHandle: 'value' },
        // Clamp → LED RGB inputs
        { id: 'e9', source: 'clamp_r', target: 'led', sourceHandle: 'result', targetHandle: 'r' },
        { id: 'e10', source: 'clamp_g', target: 'led', sourceHandle: 'result', targetHandle: 'g' },
        { id: 'e11', source: 'clamp_b', target: 'led', sourceHandle: 'result', targetHandle: 'b' },
        // Armed + aux → gate → timer → LED trigger
        { id: 'e12', source: 'armed', target: 'gate', sourceHandle: 'is_armed', targetHandle: 'a' },
        { id: 'e13', source: 'aux', target: 'gate', sourceHandle: 'is_high', targetHandle: 'b' },
        { id: 'e14', source: 'gate', target: 'timer', sourceHandle: 'result', targetHandle: 'trigger' },
        { id: 'e15', source: 'timer', target: 'led', sourceHandle: 'flow', targetHandle: 'trigger' },
        // Aux → edge detect → notification
        { id: 'e16', source: 'aux', target: 'aux_edge', sourceHandle: 'is_high', targetHandle: 'input' },
        { id: 'e17', source: 'aux_edge', target: 'enable_msg', sourceHandle: 'triggered', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.7 },
    },
  },

  // ─── Preflight Health Check ──────────────────────────────────
  // Complex: 19 functional nodes + 4 comments = 23 total
  {
    id: 'preflight-health-check',
    name: 'Preflight Health Check',
    get description() { return t('lua_graph.graph_templates.onArmChecksGpsSatelliteCount'); },
    category: 'Utility',
    graph: {
      version: 1,
      name: 'Preflight Health Check',
      get description() { return t('lua_graph.graph_templates.automatedPreflightSensorChecksWithPass'); },
      runIntervalMs: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Stage comments ──
        {
          id: 'c1', type: 'flow-comment', position: { x: 40, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.sensors'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.readAllSensorHealthIndicatorsOn'); } } },
        },
        {
          id: 'c2', type: 'flow-comment', position: { x: 400, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.checks'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.verifyGpsSats8Voltage14v'); } } },
        },
        {
          id: 'c3', type: 'flow-comment', position: { x: 700, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.health'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.chainAllChecksIntoASingle'); } } },
        },
        {
          id: 'c4', type: 'flow-comment', position: { x: 1040, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.announce'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.onArmMomentPlayPassFail'); } } },
        },
        // ── Sensors ──
        {
          id: 'armed', type: 'sensor-armed', position: { x: 60, y: 120 },
          data: { definitionType: 'sensor-armed', get label() { return t('lua_graph.graph_templates.armedState'); }, category: 'sensors', propertyValues: {} },
        },
        {
          id: 'gps', type: 'sensor-gps-status', position: { x: 60, y: 280 },
          data: { definitionType: 'sensor-gps-status', get label() { return t('lua_graph.graph_templates.gpsStatus'); }, category: 'sensors', propertyValues: { instance: 0 } },
        },
        {
          id: 'battery', type: 'sensor-battery', position: { x: 60, y: 440 },
          data: { definitionType: 'sensor-battery', get label() { return t('lua_graph.graph_templates.battery'); }, category: 'sensors', propertyValues: { instance: 0 } },
        },
        {
          id: 'altitude', type: 'sensor-baro-alt', position: { x: 60, y: 580 },
          data: { definitionType: 'sensor-baro-alt', get label() { return t('lua_graph.graph_templates.altitude'); }, category: 'sensors', propertyValues: {} },
        },
        // ── Constants ──
        {
          id: 'sat_min', type: 'var-constant', position: { x: 240, y: 350 },
          data: { definitionType: 'var-constant', get label() { return t('lua_graph.graph_templates.minSats8'); }, category: 'variables', propertyValues: { type: 'number', value: '8' } },
        },
        {
          id: 'batt_min', type: 'var-constant', position: { x: 240, y: 510 },
          data: { definitionType: 'var-constant', get label() { return t('lua_graph.graph_templates.minVolts14'); }, category: 'variables', propertyValues: { type: 'number', value: '14' } },
        },
        // ── Arm edge detect ──
        {
          id: 'arm_edge', type: 'timing-rising-edge', position: { x: 420, y: 120 },
          data: { definitionType: 'timing-rising-edge', get label() { return t('lua_graph.graph_templates.armMoment'); }, category: 'timing', propertyValues: {} },
        },
        // ── Individual checks ──
        {
          id: 'sat_check', type: 'logic-compare', position: { x: 420, y: 280 },
          data: { definitionType: 'logic-compare', get label() { return t('lua_graph.graph_templates.sats8'); }, category: 'logic', propertyValues: { operator: '>=' } },
        },
        {
          id: 'batt_check', type: 'logic-compare', position: { x: 420, y: 440 },
          data: { definitionType: 'logic-compare', get label() { return t('lua_graph.graph_templates.voltage14'); }, category: 'logic', propertyValues: { operator: '>' } },
        },
        {
          id: 'alt_check', type: 'logic-range-check', position: { x: 420, y: 580 },
          data: { definitionType: 'logic-range-check', get label() { return t('lua_graph.graph_templates.nearGround'); }, category: 'logic', propertyValues: { min: -5, max: 5 } },
        },
        // ── AND chain → single health flag ──
        {
          id: 'health1', type: 'logic-and', position: { x: 660, y: 350 },
          data: { definitionType: 'logic-and', get label() { return t('lua_graph.graph_templates.gpsBattery'); }, category: 'logic', propertyValues: {} },
        },
        {
          id: 'health2', type: 'logic-and', position: { x: 660, y: 500 },
          data: { definitionType: 'logic-and', get label() { return t('lua_graph.graph_templates.allHealthy'); }, category: 'logic', propertyValues: {} },
        },
        // ── Branch: pass vs fail ──
        {
          id: 'not_healthy', type: 'logic-not', position: { x: 850, y: 560 },
          data: { definitionType: 'logic-not', get label() { return t('lua_graph.graph_templates.unhealthy'); }, category: 'logic', propertyValues: {} },
        },
        {
          id: 'pass_gate', type: 'logic-and', position: { x: 880, y: 260 },
          data: { definitionType: 'logic-and', get label() { return t('lua_graph.graph_templates.armHealthy'); }, category: 'logic', propertyValues: {} },
        },
        {
          id: 'fail_gate', type: 'logic-and', position: { x: 880, y: 480 },
          data: { definitionType: 'logic-and', get label() { return t('lua_graph.graph_templates.armUnhealthy'); }, category: 'logic', propertyValues: {} },
        },
        // ── Pass actions ──
        {
          id: 'pass_msg', type: 'action-gcs-text', position: { x: 1100, y: 180 },
          data: { definitionType: 'action-gcs-text', label: 'PASS', category: 'actions', propertyValues: { get message() { return t('lua_graph.graph_templates.preflightPassAllSystemsGo'); }, severity: 5 } },
        },
        {
          id: 'pass_tune', type: 'action-play-tune', position: { x: 1100, y: 320 },
          data: { definitionType: 'action-play-tune', get label() { return t('lua_graph.graph_templates.successBeep'); }, category: 'actions', propertyValues: { tune: 'MFT200L8O5CEGC6' } },
        },
        // ── Fail actions ──
        {
          id: 'fail_msg', type: 'action-gcs-text', position: { x: 1100, y: 460 },
          data: { definitionType: 'action-gcs-text', label: 'FAIL', category: 'actions', propertyValues: { get message() { return t('lua_graph.graph_templates.preflightFailCheckGpsBatteryAlt'); }, severity: 2 } },
        },
        {
          id: 'fail_tune', type: 'action-play-tune', position: { x: 1100, y: 600 },
          data: { definitionType: 'action-play-tune', get label() { return t('lua_graph.graph_templates.failBuzzer'); }, category: 'actions', propertyValues: { tune: 'MFT100L4O4GAGAG' } },
        },
      ],
      edges: [
        // Armed → edge detect
        { id: 'e1', source: 'armed', target: 'arm_edge', sourceHandle: 'is_armed', targetHandle: 'input' },
        // GPS check
        { id: 'e2', source: 'gps', target: 'sat_check', sourceHandle: 'num_sats', targetHandle: 'a' },
        { id: 'e3', source: 'sat_min', target: 'sat_check', sourceHandle: 'value', targetHandle: 'b' },
        // Battery check
        { id: 'e4', source: 'battery', target: 'batt_check', sourceHandle: 'voltage', targetHandle: 'a' },
        { id: 'e5', source: 'batt_min', target: 'batt_check', sourceHandle: 'value', targetHandle: 'b' },
        // Altitude check
        { id: 'e6', source: 'altitude', target: 'alt_check', sourceHandle: 'alt_m', targetHandle: 'value' },
        // AND chain: sat + batt → health1, health1 + alt → health2
        { id: 'e7', source: 'sat_check', target: 'health1', sourceHandle: 'result', targetHandle: 'a' },
        { id: 'e8', source: 'batt_check', target: 'health1', sourceHandle: 'result', targetHandle: 'b' },
        { id: 'e9', source: 'health1', target: 'health2', sourceHandle: 'result', targetHandle: 'a' },
        { id: 'e10', source: 'alt_check', target: 'health2', sourceHandle: 'in_range', targetHandle: 'b' },
        // Pass path: arm_edge AND health2
        { id: 'e11', source: 'arm_edge', target: 'pass_gate', sourceHandle: 'triggered', targetHandle: 'a' },
        { id: 'e12', source: 'health2', target: 'pass_gate', sourceHandle: 'result', targetHandle: 'b' },
        { id: 'e13', source: 'pass_gate', target: 'pass_msg', sourceHandle: 'result', targetHandle: 'trigger' },
        { id: 'e14', source: 'pass_gate', target: 'pass_tune', sourceHandle: 'result', targetHandle: 'trigger' },
        // Fail path: arm_edge AND NOT(health2)
        { id: 'e15', source: 'health2', target: 'not_healthy', sourceHandle: 'result', targetHandle: 'input' },
        { id: 'e16', source: 'arm_edge', target: 'fail_gate', sourceHandle: 'triggered', targetHandle: 'a' },
        { id: 'e17', source: 'not_healthy', target: 'fail_gate', sourceHandle: 'result', targetHandle: 'b' },
        { id: 'e18', source: 'fail_gate', target: 'fail_msg', sourceHandle: 'result', targetHandle: 'trigger' },
        { id: 'e19', source: 'fail_gate', target: 'fail_tune', sourceHandle: 'result', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.65 },
    },
  },

  // ─── Multi-Timer Task Scheduler ──────────────────────────────
  // Complex: 16 functional nodes + 4 comments = 20 total
  {
    id: 'multi-timer-scheduler',
    name: 'Multi-Timer Task Scheduler',
    get description() { return t('lua_graph.graph_templates.threeIndependentTimersRunningAtDifferent'); },
    category: 'Utility',
    graph: {
      version: 1,
      name: 'Multi-Timer Task Scheduler',
      get description() { return t('lua_graph.graph_templates.independentTimedTasksForLoggingAnd'); },
      runIntervalMs: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Stage comments ──
        {
          id: 'c1', type: 'flow-comment', position: { x: 40, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.sensors'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.readGpsBatteryAndSatelliteStatus'); } } },
        },
        {
          id: 'c2', type: 'flow-comment', position: { x: 360, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.timers'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.threeIndependentTimersAllGatedBy'); } } },
        },
        {
          id: 'c3', type: 'flow-comment', position: { x: 620, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.conditions'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.onlyWarnWhenConditionsAreActually'); } } },
        },
        {
          id: 'c4', type: 'flow-comment', position: { x: 920, y: 20 },
          data: { definitionType: 'flow-comment', get label() { return t('lua_graph.graph_templates.actions'); }, category: 'flow', propertyValues: { get text() { return t('lua_graph.graph_templates.logDataAndSendConditionalWarnings'); } } },
        },
        // ── Sensors ──
        {
          id: 'armed', type: 'sensor-armed', position: { x: 60, y: 140 },
          data: { definitionType: 'sensor-armed', get label() { return t('lua_graph.graph_templates.armedState'); }, category: 'sensors', propertyValues: {} },
        },
        {
          id: 'gps', type: 'sensor-gps', position: { x: 60, y: 280 },
          data: { definitionType: 'sensor-gps', get label() { return t('lua_graph.graph_templates.gpsPosition'); }, category: 'sensors', propertyValues: {} },
        },
        {
          id: 'battery', type: 'sensor-battery', position: { x: 60, y: 460 },
          data: { definitionType: 'sensor-battery', get label() { return t('lua_graph.graph_templates.battery'); }, category: 'sensors', propertyValues: { instance: 0 } },
        },
        {
          id: 'gps_status', type: 'sensor-gps-status', position: { x: 60, y: 620 },
          data: { definitionType: 'sensor-gps-status', get label() { return t('lua_graph.graph_templates.gpsQuality'); }, category: 'sensors', propertyValues: { instance: 0 } },
        },
        // ── Thresholds ──
        {
          id: 'batt_threshold', type: 'var-constant', position: { x: 240, y: 530 },
          data: { definitionType: 'var-constant', get label() { return t('lua_graph.graph_templates.minBattery'); }, category: 'variables', propertyValues: { type: 'number', value: '20' } },
        },
        {
          id: 'sat_threshold', type: 'var-constant', position: { x: 240, y: 690 },
          data: { definitionType: 'var-constant', get label() { return t('lua_graph.graph_templates.minSats'); }, category: 'variables', propertyValues: { type: 'number', value: '6' } },
        },
        // ── Timers (all armed-gated) ──
        {
          id: 'timer_log', type: 'timing-run-every', position: { x: 380, y: 200 },
          data: { definitionType: 'timing-run-every', get label() { return t('lua_graph.graph_templates.every2sLog'); }, category: 'timing', propertyValues: { interval_ms: 2000 } },
        },
        {
          id: 'timer_batt', type: 'timing-run-every', position: { x: 380, y: 400 },
          data: { definitionType: 'timing-run-every', get label() { return t('lua_graph.graph_templates.every10sBatt'); }, category: 'timing', propertyValues: { interval_ms: 10000 } },
        },
        {
          id: 'timer_gps', type: 'timing-run-every', position: { x: 380, y: 580 },
          data: { definitionType: 'timing-run-every', get label() { return t('lua_graph.graph_templates.every30sGps'); }, category: 'timing', propertyValues: { interval_ms: 30000 } },
        },
        // ── Conditional checks ──
        {
          id: 'batt_low', type: 'logic-compare', position: { x: 620, y: 460 },
          data: { definitionType: 'logic-compare', get label() { return t('lua_graph.graph_templates.battery20'); }, category: 'logic', propertyValues: { operator: '<' } },
        },
        {
          id: 'sats_low', type: 'logic-compare', position: { x: 620, y: 620 },
          data: { definitionType: 'logic-compare', get label() { return t('lua_graph.graph_templates.sats6'); }, category: 'logic', propertyValues: { operator: '<' } },
        },
        // ── Gates: timer fires AND condition is bad ──
        {
          id: 'batt_gate', type: 'logic-and', position: { x: 820, y: 400 },
          data: { definitionType: 'logic-and', get label() { return t('lua_graph.graph_templates.timerLowBatt'); }, category: 'logic', propertyValues: {} },
        },
        {
          id: 'gps_gate', type: 'logic-and', position: { x: 820, y: 580 },
          data: { definitionType: 'logic-and', get label() { return t('lua_graph.graph_templates.timerLowSats'); }, category: 'logic', propertyValues: {} },
        },
        // ── Actions ──
        {
          id: 'log_gps', type: 'action-log-to-file', position: { x: 940, y: 140 },
          data: { definitionType: 'action-log-to-file', get label() { return t('lua_graph.graph_templates.logGpsAlt'); }, category: 'actions', propertyValues: { filename: 'flight_track.csv', separator: ',' } },
        },
        {
          id: 'batt_warn', type: 'action-gcs-text', position: { x: 1040, y: 380 },
          data: { definitionType: 'action-gcs-text', get label() { return t('lua_graph.graph_templates.batteryWarning'); }, category: 'actions', propertyValues: { get message() { return t('lua_graph.graph_templates.warningBatteryBelow20'); }, severity: 4 } },
        },
        {
          id: 'gps_warn', type: 'action-gcs-text', position: { x: 1040, y: 560 },
          data: { definitionType: 'action-gcs-text', get label() { return t('lua_graph.graph_templates.gpsWarning'); }, category: 'actions', propertyValues: { get message() { return t('lua_graph.graph_templates.warningLowSatelliteCount'); }, severity: 4 } },
        },
      ],
      edges: [
        // Armed gates all 3 timers
        { id: 'e1', source: 'armed', target: 'timer_log', sourceHandle: 'is_armed', targetHandle: 'trigger' },
        { id: 'e2', source: 'armed', target: 'timer_batt', sourceHandle: 'is_armed', targetHandle: 'trigger' },
        { id: 'e3', source: 'armed', target: 'timer_gps', sourceHandle: 'is_armed', targetHandle: 'trigger' },
        // Timer 1 → GPS log
        { id: 'e4', source: 'timer_log', target: 'log_gps', sourceHandle: 'flow', targetHandle: 'trigger' },
        { id: 'e5', source: 'gps', target: 'log_gps', sourceHandle: 'lat', targetHandle: 'value1' },
        { id: 'e6', source: 'gps', target: 'log_gps', sourceHandle: 'lng', targetHandle: 'value2' },
        { id: 'e7', source: 'gps', target: 'log_gps', sourceHandle: 'alt', targetHandle: 'value3' },
        // Battery check
        { id: 'e8', source: 'battery', target: 'batt_low', sourceHandle: 'remaining_pct', targetHandle: 'a' },
        { id: 'e9', source: 'batt_threshold', target: 'batt_low', sourceHandle: 'value', targetHandle: 'b' },
        // Timer 2 AND batt_low → warning
        { id: 'e10', source: 'timer_batt', target: 'batt_gate', sourceHandle: 'flow', targetHandle: 'a' },
        { id: 'e11', source: 'batt_low', target: 'batt_gate', sourceHandle: 'result', targetHandle: 'b' },
        { id: 'e12', source: 'batt_gate', target: 'batt_warn', sourceHandle: 'result', targetHandle: 'trigger' },
        // Satellite check
        { id: 'e13', source: 'gps_status', target: 'sats_low', sourceHandle: 'num_sats', targetHandle: 'a' },
        { id: 'e14', source: 'sat_threshold', target: 'sats_low', sourceHandle: 'value', targetHandle: 'b' },
        // Timer 3 AND sats_low → warning
        { id: 'e15', source: 'timer_gps', target: 'gps_gate', sourceHandle: 'flow', targetHandle: 'a' },
        { id: 'e16', source: 'sats_low', target: 'gps_gate', sourceHandle: 'result', targetHandle: 'b' },
        { id: 'e17', source: 'gps_gate', target: 'gps_warn', sourceHandle: 'result', targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.7 },
    },
  },

  // ─── ArduDeck Heartbeat Beacon ────────────────────────────────
  // The minimum-viable FC-side script: publish a NAMED_VALUE_FLOAT every
  // second so the GCS can confirm the script is loaded and running.
  // This is the same pattern ArduDeck's own ardudeck_commands.lua uses for AD_HB.
  {
    id: 'ad-heartbeat-beacon',
    name: 'ArduDeck Heartbeat Beacon',
    get description() { return t('lua_graph.graph_templates.publishANamedValueFloatHeartbeat'); },
    category: 'FC Script',
    graph: {
      version: 1,
      name: 'ArduDeck Heartbeat Beacon',
      get description() { return t('lua_graph.graph_templates.publishAdHbOncePerSecond'); },
      runIntervalMs: 100,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_timer',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.tickOncePerSecond'); } },
          },
        },
        {
          id: 'comment_publish',
          type: 'flow-comment',
          position: { x: 480, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.sendAdHbToTheGcs'); } },
          },
        },
        {
          id: 'timer',
          type: 'timing-run-every',
          position: { x: 60, y: 100 },
          data: {
            definitionType: 'timing-run-every',
            get label() { return t('lua_graph.graph_templates.every1Sec'); },
            category: 'timing',
            propertyValues: { interval_ms: 1000 },
          },
        },
        {
          id: 'version',
          type: 'var-constant',
          position: { x: 240, y: 280 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.scriptVersion'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '1.0' },
          },
        },
        {
          id: 'publish',
          type: 'action-publish-named-float',
          position: { x: 500, y: 110 },
          data: {
            definitionType: 'action-publish-named-float',
            get label() { return t('lua_graph.graph_templates.publishAdHb'); },
            category: 'actions',
            propertyValues: { name: 'AD_HB' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'timer',   target: 'publish', sourceHandle: 'flow',  targetHandle: 'trigger' },
        { id: 'e2', source: 'version', target: 'publish', sourceHandle: 'value', targetHandle: 'value' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.9 },
    },
  },

  // ─── Telemetry Beacon (3 Channels) ────────────────────────────
  // Publishes distance-to-home, satellite count, and battery voltage as
  // NAMED_VALUE_FLOATs every second so a GCS dashboard can show them as
  // first-class telemetry without parsing custom MAVLink.
  {
    id: 'telemetry-beacon',
    name: 'Telemetry Beacon (3 Channels)',
    get description() { return t('lua_graph.graph_templates.publishDistanceToHomeSatCount'); },
    category: 'FC Script',
    graph: {
      version: 1,
      name: 'Telemetry Beacon',
      get description() { return t('lua_graph.graph_templates.publishDistHSatsBattV'); },
      runIntervalMs: 100,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readLivePositionGpsStatusAnd'); } },
          },
        },
        {
          id: 'comment_compute',
          type: 'flow-comment',
          position: { x: 460, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.computeDistanceFromVehicleToHome'); } },
          },
        },
        {
          id: 'comment_publish',
          type: 'flow-comment',
          position: { x: 880, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.publishEachValueAsANamed'); } },
          },
        },
        {
          id: 'timer',
          type: 'timing-run-every',
          position: { x: 60, y: 100 },
          data: {
            definitionType: 'timing-run-every',
            get label() { return t('lua_graph.graph_templates.every1Sec'); },
            category: 'timing',
            propertyValues: { interval_ms: 1000 },
          },
        },
        {
          id: 'ahrs_loc',
          type: 'sensor-ahrs-location',
          position: { x: 60, y: 240 },
          data: {
            definitionType: 'sensor-ahrs-location',
            get label() { return t('lua_graph.graph_templates.vehicleLocation'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'home',
          type: 'sensor-home',
          position: { x: 60, y: 380 },
          data: {
            definitionType: 'sensor-home',
            get label() { return t('lua_graph.graph_templates.homePosition'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'gps_status',
          type: 'sensor-gps-status',
          position: { x: 60, y: 520 },
          data: {
            definitionType: 'sensor-gps-status',
            get label() { return t('lua_graph.graph_templates.gpsStatus'); },
            category: 'sensors',
            propertyValues: { instance: 0 },
          },
        },
        {
          id: 'battery',
          type: 'sensor-battery',
          position: { x: 60, y: 660 },
          data: {
            definitionType: 'sensor-battery',
            get label() { return t('lua_graph.graph_templates.battery'); },
            category: 'sensors',
            propertyValues: { instance: 0 },
          },
        },
        {
          id: 'distance',
          type: 'math-location-distance',
          position: { x: 480, y: 290 },
          data: {
            definitionType: 'math-location-distance',
            get label() { return t('lua_graph.graph_templates.vehicleHome'); },
            category: 'math',
            propertyValues: {},
          },
        },
        {
          id: 'pub_dist',
          type: 'action-publish-named-float',
          position: { x: 900, y: 240 },
          data: {
            definitionType: 'action-publish-named-float',
            get label() { return t('lua_graph.graph_templates.publishDistH'); },
            category: 'actions',
            propertyValues: { name: 'DIST_H' },
          },
        },
        {
          id: 'pub_sats',
          type: 'action-publish-named-float',
          position: { x: 900, y: 420 },
          data: {
            definitionType: 'action-publish-named-float',
            get label() { return t('lua_graph.graph_templates.publishSats'); },
            category: 'actions',
            propertyValues: { name: 'SATS' },
          },
        },
        {
          id: 'pub_batt',
          type: 'action-publish-named-float',
          position: { x: 900, y: 600 },
          data: {
            definitionType: 'action-publish-named-float',
            get label() { return t('lua_graph.graph_templates.publishBattV'); },
            category: 'actions',
            propertyValues: { name: 'BATT_V' },
          },
        },
      ],
      edges: [
        // Compute distance from vehicle to home
        { id: 'e1', source: 'ahrs_loc', target: 'distance', sourceHandle: 'location', targetHandle: 'a' },
        { id: 'e2', source: 'home',     target: 'distance', sourceHandle: 'location', targetHandle: 'b' },
        // Publish each value once per timer tick
        { id: 'e3', source: 'timer',    target: 'pub_dist', sourceHandle: 'flow', targetHandle: 'trigger' },
        { id: 'e4', source: 'distance', target: 'pub_dist', sourceHandle: 'distance_m', targetHandle: 'value' },
        { id: 'e5', source: 'timer',    target: 'pub_sats', sourceHandle: 'flow', targetHandle: 'trigger' },
        { id: 'e6', source: 'gps_status', target: 'pub_sats', sourceHandle: 'num_sats', targetHandle: 'value' },
        { id: 'e7', source: 'timer',    target: 'pub_batt', sourceHandle: 'flow', targetHandle: 'trigger' },
        { id: 'e8', source: 'battery',  target: 'pub_batt', sourceHandle: 'voltage', targetHandle: 'value' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.65 },
    },
  },

  // ─── GUIDED Set-Target via RC Switch ──────────────────────────
  // RC AUX HIGH → command vehicle to fly to a fixed offset from home (e.g.
  // "the staging spot 50m due north"). Demonstrates the RC-trigger →
  // location-math → set-target-location chain that powers most ad-hoc
  // commanding scripts.
  {
    id: 'guided-set-target-rc',
    name: 'GUIDED Set-Target via RC Switch',
    get description() { return t('lua_graph.graph_templates.whenAnRcAuxSwitchIs'); },
    category: 'FC Script',
    graph: {
      version: 1,
      name: 'GUIDED Set-Target via RC Switch',
      get description() { return t('lua_graph.graph_templates.rcAuxHighFlyToHome'); },
      runIntervalMs: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_trigger',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.watchRcAuxSwitchState'); } },
          },
        },
        {
          id: 'comment_target',
          type: 'flow-comment',
          position: { x: 480, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.computeTargetHomeOffsetBy50m'); } },
          },
        },
        {
          id: 'comment_action',
          type: 'flow-comment',
          position: { x: 900, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.pushGuidedTargetWhileSwitchIs'); } },
          },
        },
        {
          id: 'rc_aux',
          type: 'sensor-rc-aux-switch',
          position: { x: 60, y: 110 },
          data: {
            definitionType: 'sensor-rc-aux-switch',
            label: 'RC AUX 7',
            category: 'sensors',
            propertyValues: { aux_fn: 7 },
          },
        },
        {
          id: 'home',
          type: 'sensor-home',
          position: { x: 60, y: 280 },
          data: {
            definitionType: 'sensor-home',
            get label() { return t('lua_graph.graph_templates.home'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'bearing',
          type: 'var-constant',
          position: { x: 280, y: 460 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.bearingDeg'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '0' },
          },
        },
        {
          id: 'distance',
          type: 'var-constant',
          position: { x: 280, y: 580 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.distanceM'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '50' },
          },
        },
        {
          id: 'offset',
          type: 'math-location-offset',
          position: { x: 500, y: 280 },
          data: {
            definitionType: 'math-location-offset',
            get label() { return t('lua_graph.graph_templates.home50mN'); },
            category: 'math',
            propertyValues: {},
          },
        },
        {
          id: 'set_target',
          type: 'action-set-target-location',
          position: { x: 920, y: 200 },
          data: {
            definitionType: 'action-set-target-location',
            get label() { return t('lua_graph.graph_templates.guidedTarget'); },
            category: 'actions',
            propertyValues: {},
          },
        },
      ],
      edges: [
        // Build the offset target location
        { id: 'e1', source: 'home',     target: 'offset', sourceHandle: 'location',    targetHandle: 'from' },
        { id: 'e2', source: 'bearing',  target: 'offset', sourceHandle: 'value',       targetHandle: 'bearing_deg' },
        { id: 'e3', source: 'distance', target: 'offset', sourceHandle: 'value',       targetHandle: 'distance_m' },
        // Push the target while the switch is HIGH
        { id: 'e4', source: 'rc_aux',   target: 'set_target', sourceHandle: 'is_high', targetHandle: 'trigger' },
        { id: 'e5', source: 'offset',   target: 'set_target', sourceHandle: 'location', targetHandle: 'location' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.7 },
    },
  },

  // ─── Distance-Triggered RTL ───────────────────────────────────
  // When the vehicle drifts more than N metres from home, automatically
  // switch to RTL mode. Useful as a backup geofence in case the operator
  // misses an alert. Demonstrates location math + mode change.
  {
    id: 'distance-triggered-rtl',
    name: 'Distance-Triggered RTL',
    get description() { return t('lua_graph.graph_templates.whenVehicleDriftsMoreThan200m'); },
    category: 'FC Script',
    graph: {
      version: 1,
      name: 'Distance-Triggered RTL',
      get description() { return t('lua_graph.graph_templates.autoRtlWhenDistanceFromHome'); },
      runIntervalMs: 500,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readLivePositionHome'); } },
          },
        },
        {
          id: 'comment_check',
          type: 'flow-comment',
          position: { x: 460, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.areWeMoreThan200mFrom'); } },
          },
        },
        {
          id: 'comment_action',
          type: 'flow-comment',
          position: { x: 880, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.switchToRtlModeCopterMode'); } },
          },
        },
        {
          id: 'ahrs_loc',
          type: 'sensor-ahrs-location',
          position: { x: 60, y: 110 },
          data: {
            definitionType: 'sensor-ahrs-location',
            get label() { return t('lua_graph.graph_templates.vehicle'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'home',
          type: 'sensor-home',
          position: { x: 60, y: 260 },
          data: {
            definitionType: 'sensor-home',
            get label() { return t('lua_graph.graph_templates.home'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'distance',
          type: 'math-location-distance',
          position: { x: 480, y: 180 },
          data: {
            definitionType: 'math-location-distance',
            get label() { return t('lua_graph.graph_templates.distanceToHome'); },
            category: 'math',
            propertyValues: {},
          },
        },
        {
          id: 'limit',
          type: 'var-constant',
          position: { x: 280, y: 420 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.limitM'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '200' },
          },
        },
        {
          id: 'compare',
          type: 'logic-compare',
          position: { x: 480, y: 360 },
          data: {
            definitionType: 'logic-compare',
            get label() { return t('lua_graph.graph_templates.distance200'); },
            category: 'logic',
            propertyValues: { operator: '>' },
          },
        },
        {
          id: 'set_rtl',
          type: 'action-set-mode',
          position: { x: 900, y: 120 },
          data: {
            definitionType: 'action-set-mode',
            get label() { return t('lua_graph.graph_templates.switchToRtl'); },
            category: 'actions',
            propertyValues: { mode_num: 6 },
          },
        },
        {
          id: 'warn',
          type: 'action-gcs-text',
          position: { x: 900, y: 280 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.warnPilot'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.autoRtlDistanceFromHomeExceeded'); }, severity: 4 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'ahrs_loc', target: 'distance', sourceHandle: 'location',  targetHandle: 'a' },
        { id: 'e2', source: 'home',     target: 'distance', sourceHandle: 'location',  targetHandle: 'b' },
        { id: 'e3', source: 'distance', target: 'compare',  sourceHandle: 'distance_m', targetHandle: 'a' },
        { id: 'e4', source: 'limit',    target: 'compare',  sourceHandle: 'value',     targetHandle: 'b' },
        { id: 'e5', source: 'compare',  target: 'set_rtl',  sourceHandle: 'result',    targetHandle: 'trigger' },
        { id: 'e6', source: 'compare',  target: 'warn',     sourceHandle: 'result',    targetHandle: 'trigger' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.75 },
    },
  },

  // ─── Patrol Between Two Anchors ───────────────────────────────
  // Toggle between two fixed offsets from home every 30 seconds. A simple
  // ad-hoc patrol pattern that doesn't need a planned mission. Demonstrates
  // the timing-latch pattern + dual conditional set-target-location.
  {
    id: 'patrol-two-anchors',
    name: 'Patrol Between Two Anchors',
    get description() { return t('lua_graph.graph_templates.toggleTheGuidedTargetBetweenTwo'); },
    category: 'FC Script',
    graph: {
      version: 1,
      name: 'Patrol Between Two Anchors',
      get description() { return t('lua_graph.graph_templates.alternateTargetBetweenHome80mN'); },
      runIntervalMs: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_timer',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.toggleEvery30sUsingALatch'); } },
          },
        },
        {
          id: 'comment_anchors',
          type: 'flow-comment',
          position: { x: 480, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.buildTwoAnchorPositionsFromHome'); } },
          },
        },
        {
          id: 'comment_select',
          type: 'flow-comment',
          position: { x: 920, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.pushTheActiveAnchorAsGuided'); } },
          },
        },
        // Toggle source
        {
          id: 'timer',
          type: 'timing-run-every',
          position: { x: 60, y: 100 },
          data: {
            definitionType: 'timing-run-every',
            get label() { return t('lua_graph.graph_templates.every30s'); },
            category: 'timing',
            propertyValues: { interval_ms: 30000 },
          },
        },
        {
          id: 'latch',
          type: 'timing-latch',
          position: { x: 240, y: 200 },
          data: {
            definitionType: 'timing-latch',
            get label() { return t('lua_graph.graph_templates.patrolToggle'); },
            category: 'timing',
            propertyValues: {},
          },
        },
        {
          id: 'not_latch',
          type: 'logic-not',
          position: { x: 240, y: 320 },
          data: {
            definitionType: 'logic-not',
            get label() { return t('lua_graph.graph_templates.otherAnchor'); },
            category: 'logic',
            propertyValues: {},
          },
        },
        // Anchor positions
        {
          id: 'home',
          type: 'sensor-home',
          position: { x: 480, y: 200 },
          data: {
            definitionType: 'sensor-home',
            get label() { return t('lua_graph.graph_templates.home'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'bearing_a',
          type: 'var-constant',
          position: { x: 480, y: 380 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.aBearingN'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '0' },
          },
        },
        {
          id: 'bearing_b',
          type: 'var-constant',
          position: { x: 480, y: 480 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.bBearingS'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '180' },
          },
        },
        {
          id: 'patrol_dist',
          type: 'var-constant',
          position: { x: 480, y: 580 },
          data: {
            definitionType: 'var-constant',
            get label() { return t('lua_graph.graph_templates.legLengthM'); },
            category: 'variables',
            propertyValues: { type: 'number', value: '80' },
          },
        },
        {
          id: 'anchor_a',
          type: 'math-location-offset',
          position: { x: 720, y: 230 },
          data: {
            definitionType: 'math-location-offset',
            get label() { return t('lua_graph.graph_templates.anchorA'); },
            category: 'math',
            propertyValues: {},
          },
        },
        {
          id: 'anchor_b',
          type: 'math-location-offset',
          position: { x: 720, y: 430 },
          data: {
            definitionType: 'math-location-offset',
            get label() { return t('lua_graph.graph_templates.anchorB'); },
            category: 'math',
            propertyValues: {},
          },
        },
        // Two set-target nodes, one per anchor, gated by the latch state.
        {
          id: 'set_a',
          type: 'action-set-target-location',
          position: { x: 940, y: 230 },
          data: {
            definitionType: 'action-set-target-location',
            get label() { return t('lua_graph.graph_templates.goToA'); },
            category: 'actions',
            propertyValues: {},
          },
        },
        {
          id: 'set_b',
          type: 'action-set-target-location',
          position: { x: 940, y: 430 },
          data: {
            definitionType: 'action-set-target-location',
            get label() { return t('lua_graph.graph_templates.goToB'); },
            category: 'actions',
            propertyValues: {},
          },
        },
      ],
      edges: [
        // Toggle latch each 30s pulse, then NOT for the other branch
        { id: 'e1', source: 'timer',     target: 'latch',     sourceHandle: 'flow',  targetHandle: 'set' },
        { id: 'e2', source: 'latch',     target: 'not_latch', sourceHandle: 'state', targetHandle: 'input' },
        // Build Anchor A = home + (0°, 80m)
        { id: 'e3', source: 'home',        target: 'anchor_a', sourceHandle: 'location', targetHandle: 'from' },
        { id: 'e4', source: 'bearing_a',   target: 'anchor_a', sourceHandle: 'value',    targetHandle: 'bearing_deg' },
        { id: 'e5', source: 'patrol_dist', target: 'anchor_a', sourceHandle: 'value',    targetHandle: 'distance_m' },
        // Build Anchor B = home + (180°, 80m)
        { id: 'e6', source: 'home',        target: 'anchor_b', sourceHandle: 'location', targetHandle: 'from' },
        { id: 'e7', source: 'bearing_b',   target: 'anchor_b', sourceHandle: 'value',    targetHandle: 'bearing_deg' },
        { id: 'e8', source: 'patrol_dist', target: 'anchor_b', sourceHandle: 'value',    targetHandle: 'distance_m' },
        // Set targets: A when latch=true, B when latch=false
        { id: 'e9',  source: 'latch',     target: 'set_a', sourceHandle: 'state',    targetHandle: 'trigger' },
        { id: 'e10', source: 'anchor_a',  target: 'set_a', sourceHandle: 'location', targetHandle: 'location' },
        { id: 'e11', source: 'not_latch', target: 'set_b', sourceHandle: 'result',   targetHandle: 'trigger' },
        { id: 'e12', source: 'anchor_b',  target: 'set_b', sourceHandle: 'location', targetHandle: 'location' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.6 },
    },
  },

  // ─── Camera Trigger Watchdog ──────────────────────────────────
  {
    id: 'camera-trigger-watchdog',
    name: 'Camera Trigger Watchdog',
    get description() { return t('lua_graph.graph_templates.warnOnTheGcsWithThe'); },
    category: 'Safety',
    graph: {
      version: 1,
      name: 'Camera Trigger Watchdog',
      get description() { return t('lua_graph.graph_templates.alertWhenADistanceTriggeredCamera'); },
      runIntervalMs: 100,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2026-07-09T00:00:00.000Z',
      nodes: [
        {
          id: 'comment_photo',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.realPhotoHotshoePulseCaughtBy'); } },
          },
        },
        {
          id: 'comment_gate',
          type: 'flow-comment',
          position: { x: 40, y: 300 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.onlyWatchWhileArmedAndThe'); } },
          },
        },
        {
          id: 'comment_warn',
          type: 'flow-comment',
          position: { x: 900, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.noPhotoWithinTheTimeoutWarn'); } },
          },
        },
        {
          id: 'pulse',
          type: 'sensor-pwm-pulse',
          position: { x: 320, y: 90 },
          data: {
            definitionType: 'sensor-pwm-pulse',
            get label() { return t('lua_graph.graph_templates.hotshoePulse'); },
            category: 'sensors',
            propertyValues: { pin: 54 },
          },
        },
        {
          id: 'param_trigg',
          type: 'sensor-param-get',
          position: { x: 60, y: 370 },
          data: {
            definitionType: 'sensor-param-get',
            get label() { return t('lua_graph.graph_templates.triggerDistance'); },
            category: 'sensors',
            propertyValues: { param_name: 'CAM1_TRIGG_DIST' },
          },
        },
        {
          id: 'trigg_active',
          type: 'logic-compare',
          position: { x: 320, y: 370 },
          data: {
            definitionType: 'logic-compare',
            get label() { return t('lua_graph.graph_templates.dist0'); },
            category: 'logic',
            propertyValues: { operator: '>' },
          },
        },
        {
          id: 'armed',
          type: 'sensor-armed',
          position: { x: 320, y: 500 },
          data: {
            definitionType: 'sensor-armed',
            get label() { return t('lua_graph.graph_templates.armed2'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'gate_and',
          type: 'logic-and',
          position: { x: 580, y: 420 },
          data: {
            definitionType: 'logic-and',
            get label() { return t('lua_graph.graph_templates.armedAndTriggering'); },
            category: 'logic',
            propertyValues: {},
          },
        },
        {
          id: 'watchdog',
          type: 'timing-watchdog',
          position: { x: 840, y: 250 },
          data: {
            definitionType: 'timing-watchdog',
            get label() { return t('lua_graph.graph_templates.noPhotoTimer'); },
            category: 'timing',
            propertyValues: { timeout_ms: 3000 },
          },
        },
        {
          id: 'warn_edge',
          type: 'timing-rising-edge',
          position: { x: 1080, y: 250 },
          data: {
            definitionType: 'timing-rising-edge',
            get label() { return t('lua_graph.graph_templates.onFirstStall'); },
            category: 'timing',
            propertyValues: {},
          },
        },
        {
          id: 'wp',
          type: 'sensor-current-waypoint',
          position: { x: 1080, y: 400 },
          data: {
            definitionType: 'sensor-current-waypoint',
            get label() { return t('lua_graph.graph_templates.currentWp'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'warn',
          type: 'action-gcs-text',
          position: { x: 1320, y: 250 },
          data: {
            definitionType: 'action-gcs-text',
            get label() { return t('lua_graph.graph_templates.warnNoPhoto'); },
            category: 'actions',
            propertyValues: { get message() { return t('lua_graph.graph_templates.camWatchdogKeinFotoBeiWp'); }, severity: 4 },
          },
        },
      ],
      edges: [
        { id: 'e3', source: 'param_trigg', target: 'trigg_active', sourceHandle: 'value', targetHandle: 'a' },
        { id: 'e4', source: 'trigg_active', target: 'gate_and', sourceHandle: 'result', targetHandle: 'a' },
        { id: 'e5', source: 'armed', target: 'gate_and', sourceHandle: 'is_armed', targetHandle: 'b' },
        { id: 'e6', source: 'pulse', target: 'watchdog', sourceHandle: 'pulse_seen', targetHandle: 'kick' },
        { id: 'e7', source: 'gate_and', target: 'watchdog', sourceHandle: 'result', targetHandle: 'enable' },
        { id: 'e8', source: 'watchdog', target: 'warn_edge', sourceHandle: 'expired', targetHandle: 'input' },
        { id: 'e9', source: 'warn_edge', target: 'warn', sourceHandle: 'triggered', targetHandle: 'trigger' },
        { id: 'e10', source: 'wp', target: 'warn', sourceHandle: 'index', targetHandle: 'value' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.75 },
    },
  },

  // ─── Custom Serial Telemetry ─────────────────────────────────
  {
    id: 'custom-serial-telemetry',
    name: 'Custom Serial Telemetry',
    get description() { return t('lua_graph.graph_templates.formatPositionBatteryIntoACustom'); },
    category: 'Utility',
    graph: {
      version: 1,
      name: 'Custom Serial Telemetry',
      get description() { return t('lua_graph.graph_templates.customFormattedTelemetrySentenceOverSerial'); },
      runIntervalMs: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [
        // ── Annotations ──
        {
          id: 'comment_sense',
          type: 'flow-comment',
          position: { x: 40, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step1'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.readPositionAndBattery'); } },
          },
        },
        {
          id: 'comment_format',
          type: 'flow-comment',
          position: { x: 420, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step2'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.customLuaBuildsTheMessageEdit'); } },
          },
        },
        {
          id: 'comment_send',
          type: 'flow-comment',
          position: { x: 800, y: 20 },
          data: {
            definitionType: 'flow-comment',
            get label() { return t('lua_graph.graph_templates.step3'); },
            category: 'flow',
            propertyValues: { get text() { return t('lua_graph.graph_templates.rateLimitTo1HzSend'); } },
          },
        },
        // ── Sensors ──
        {
          id: 'gps',
          type: 'sensor-gps',
          position: { x: 60, y: 100 },
          data: {
            definitionType: 'sensor-gps',
            get label() { return t('lua_graph.graph_templates.gpsPosition'); },
            category: 'sensors',
            propertyValues: {},
          },
        },
        {
          id: 'battery',
          type: 'sensor-battery',
          position: { x: 60, y: 280 },
          data: {
            definitionType: 'sensor-battery',
            get label() { return t('lua_graph.graph_templates.battery'); },
            category: 'sensors',
            propertyValues: { instance: 0 },
          },
        },
        // ── Format ──
        {
          id: 'format',
          type: 'flow-custom-lua',
          position: { x: 440, y: 120 },
          data: {
            definitionType: 'flow-custom-lua',
            get label() { return t('lua_graph.graph_templates.buildSentence'); },
            category: 'flow',
            propertyValues: {
              inputs: 'lat, lng, alt, volt',
              outputs: 'line',
              code: '-- Any Lua you like. Inputs are locals, return feeds the output pins.\nreturn string.format("$ADK,%.6f,%.6f,%.1f,%.2f", lat, lng, alt, volt)',
            },
          },
        },
        // ── Rate limit + outputs ──
        {
          id: 'timer',
          type: 'timing-run-every',
          position: { x: 440, y: 340 },
          data: {
            definitionType: 'timing-run-every',
            get label() { return t('lua_graph.graph_templates.every1s'); },
            category: 'timing',
            propertyValues: { interval_ms: 1000 },
          },
        },
        {
          id: 'serial_out',
          type: 'action-serial-write',
          position: { x: 820, y: 100 },
          data: {
            definitionType: 'action-serial-write',
            get label() { return t('lua_graph.graph_templates.serialOut'); },
            category: 'actions',
            propertyValues: { instance: 0, baud: 57600, line_ending: 'lf' },
          },
        },
        {
          id: 'udp_out',
          type: 'action-socket-send',
          position: { x: 820, y: 290 },
          data: {
            definitionType: 'action-socket-send',
            get label() { return t('lua_graph.graph_templates.udpOut'); },
            category: 'actions',
            propertyValues: { protocol: 'udp', ip: '192.168.1.10', port: 14550 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'gps', target: 'format', sourceHandle: 'lat', targetHandle: 'lat' },
        { id: 'e2', source: 'gps', target: 'format', sourceHandle: 'lng', targetHandle: 'lng' },
        { id: 'e3', source: 'gps', target: 'format', sourceHandle: 'alt', targetHandle: 'alt' },
        { id: 'e4', source: 'battery', target: 'format', sourceHandle: 'voltage', targetHandle: 'volt' },
        { id: 'e5', source: 'timer', target: 'serial_out', sourceHandle: 'flow', targetHandle: 'trigger' },
        { id: 'e6', source: 'format', target: 'serial_out', sourceHandle: 'line', targetHandle: 'data' },
        { id: 'e7', source: 'timer', target: 'udp_out', sourceHandle: 'flow', targetHandle: 'trigger' },
        { id: 'e8', source: 'format', target: 'udp_out', sourceHandle: 'line', targetHandle: 'data' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  },
];
