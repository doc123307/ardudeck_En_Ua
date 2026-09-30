/**
 * Hand-authored graph representation of `ardudeck_commands.lua`.
 *
 * Uses the FC-script primitives we added to the node library so the graph is
 * a faithful structural translation, not a doc overview. All edges connect
 * real handles - no impossible wires.
 *
 * Three flow paths:
 *   1) Heartbeat:        timer → publish AD_HB
 *   2) Trigger handler:  on USER_1 → store orbit_center / active_command
 *   3) Orbit driver:     timer + if-active → bearing → step → project → send
 */

import type { Node, Edge } from '@xyflow/react';
import type { GraphNodeData, GraphEdgeData } from '../lua-graph/lua-graph-types';
import { t } from '../../i18n';

const X = (col: number) => 60 + col * 280;
const Y = (row: number) => 60 + row * 220;


export const ARDUDECK_COMMANDS_NODES: Node<GraphNodeData>[] = [
  // ── Row 0: heartbeat ─────────────────────────────────────────────
  {
    id: 'tick-hb',
    type: 'graphNode',
    position: { x: X(0), y: Y(0) },
    data: {
      definitionType: 'timing-run-every',
      get label() { return t('script_installer.ardudeck_commands_graph.runEvery1000Ms'); },
      category: 'timing',
      propertyValues: { interval_ms: 1000 },
    },
  },
  {
    id: 'publish-hb',
    type: 'graphNode',
    position: { x: X(1), y: Y(0) },
    data: {
      definitionType: 'action-publish-named-float',
      get label() { return t('script_installer.ardudeck_commands_graph.publishAdHbHeartbeat'); },
      category: 'actions',
      propertyValues: { name: 'AD_HB' },
    },
  },

  // ── Row 1: MAVLink trigger handler ───────────────────────────────
  {
    id: 'on-user-cmd',
    type: 'graphNode',
    position: { x: X(0), y: Y(1) },
    data: {
      definitionType: 'action-mavlink-on-user-cmd',
      get label() { return t('script_installer.ardudeck_commands_graph.onMavCmdUser1'); },
      category: 'actions',
      propertyValues: { cmd_id: 31010 },
    },
  },
  {
    id: 'store-center',
    type: 'graphNode',
    position: { x: X(1), y: Y(1) },
    data: {
      definitionType: 'var-set',
      get label() { return t('script_installer.ardudeck_commands_graph.saveOrbitCenter'); },
      category: 'variables',
      propertyValues: { name: 'orbit_center' },
    },
  },
  {
    id: 'store-active',
    type: 'graphNode',
    position: { x: X(2), y: Y(1) },
    data: {
      definitionType: 'var-set',
      get label() { return t('script_installer.ardudeck_commands_graph.setActiveCommandOrbit'); },
      category: 'variables',
      propertyValues: { name: 'active_command' },
    },
  },

  // ── Row 2: orbit driver loop ─────────────────────────────────────
  {
    id: 'tick-drive',
    type: 'graphNode',
    position: { x: X(0), y: Y(2) },
    data: {
      definitionType: 'timing-run-every',
      get label() { return t('script_installer.ardudeck_commands_graph.runEvery250Ms'); },
      category: 'timing',
      propertyValues: { interval_ms: 250 },
    },
  },
  {
    id: 'gate-active',
    type: 'graphNode',
    position: { x: X(1), y: Y(2) },
    data: {
      definitionType: 'logic-if-else',
      get label() { return t('script_installer.ardudeck_commands_graph.ifActiveCommandOrbit'); },
      category: 'logic',
      propertyValues: {},
    },
  },
  {
    id: 'read-ahrs',
    type: 'graphNode',
    position: { x: X(2), y: Y(2) - 100 },
    data: {
      definitionType: 'sensor-ahrs-location',
      get label() { return t('script_installer.ardudeck_commands_graph.readLiveVehiclePosition'); },
      category: 'sensors',
      propertyValues: {},
    },
  },
  {
    id: 'get-center',
    type: 'graphNode',
    position: { x: X(2), y: Y(2) + 100 },
    data: {
      definitionType: 'var-get',
      get label() { return t('script_installer.ardudeck_commands_graph.getOrbitCenter'); },
      category: 'variables',
      propertyValues: { name: 'orbit_center' },
    },
  },
  {
    id: 'compute-bearing',
    type: 'graphNode',
    position: { x: X(3), y: Y(2) },
    data: {
      definitionType: 'math-location-bearing',
      get label() { return t('script_installer.ardudeck_commands_graph.bearingCenterVehicle'); },
      category: 'math',
      propertyValues: {},
    },
  },
  {
    id: 'step-ahead',
    type: 'graphNode',
    position: { x: X(4), y: Y(2) },
    data: {
      definitionType: 'math-add',
      get label() { return t('script_installer.ardudeck_commands_graph.stepAheadBy8'); },
      category: 'math',
      propertyValues: {},
    },
  },
  {
    id: 'project-target',
    type: 'graphNode',
    position: { x: X(5), y: Y(2) },
    data: {
      definitionType: 'math-location-offset',
      get label() { return t('script_installer.ardudeck_commands_graph.projectNextTarget'); },
      category: 'math',
      propertyValues: {},
    },
  },
  {
    id: 'send-target',
    type: 'graphNode',
    position: { x: X(6), y: Y(2) },
    data: {
      definitionType: 'action-set-target-location',
      label: 'vehicle:set_target_location',
      category: 'actions',
      propertyValues: {},
    },
  },

  // ── Floating annotations ─────────────────────────────────────────
  {
    id: 'why-anchored',
    type: 'graphNode',
    position: { x: X(3), y: Y(3) + 60 },
    data: {
      definitionType: 'flow-comment',
      get label() { return t('script_installer.ardudeck_commands_graph.whyTelemetryAnchored'); },
      category: 'flow',
      propertyValues: {
        get text() { return t('script_installer.ardudeck_commands_graph.eachTickWeReReadThe'); },
      },
    },
  },
  {
    id: 'safety',
    type: 'graphNode',
    position: { x: X(0), y: Y(3) + 60 },
    data: {
      definitionType: 'flow-comment',
      get label() { return t('script_installer.ardudeck_commands_graph.safety'); },
      category: 'flow',
      propertyValues: {
        get text() { return t('script_installer.ardudeck_commands_graph.scriptNeverArmsOrDisarmsChanges'); },
      },
    },
  },
];

export const ARDUDECK_COMMANDS_EDGES: Edge<GraphEdgeData>[] = [
  // ── Heartbeat path ───────────────────────────────────────────────
  { id: 'e-hb', source: 'tick-hb', target: 'publish-hb', sourceHandle: 'flow', targetHandle: 'trigger' },

  // ── Trigger handler ──────────────────────────────────────────────
  // on-user-cmd fires → save orbit_center (Location), then set active_command flag
  { id: 'e-trigger-storecenter-trig', source: 'on-user-cmd',  target: 'store-center', sourceHandle: 'trigger',  targetHandle: 'trigger' },
  { id: 'e-trigger-storecenter-val',  source: 'on-user-cmd',  target: 'store-center', sourceHandle: 'location', targetHandle: 'value' },
  { id: 'e-trigger-storeactive',      source: 'on-user-cmd',  target: 'store-active', sourceHandle: 'trigger',  targetHandle: 'trigger' },

  // ── Orbit driver chain ───────────────────────────────────────────
  // Gate the loop on the active flag
  { id: 'e-tick-gate',     source: 'tick-drive',      target: 'gate-active',     sourceHandle: 'flow',        targetHandle: 'condition' },
  // Data flow into bearing(from=center, to=vehicle)
  { id: 'e-center-bearing', source: 'get-center',     target: 'compute-bearing', sourceHandle: 'value',       targetHandle: 'from' },
  { id: 'e-vehicle-bearing', source: 'read-ahrs',     target: 'compute-bearing', sourceHandle: 'location',    targetHandle: 'to' },
  // bearing → step ahead by 8°
  { id: 'e-bearing-step',  source: 'compute-bearing', target: 'step-ahead',      sourceHandle: 'bearing_deg', targetHandle: 'a' },
  // step result → project_target.bearing_deg
  { id: 'e-step-project',  source: 'step-ahead',      target: 'project-target',  sourceHandle: 'result',      targetHandle: 'bearing_deg' },
  // orbit center is also the origin of the projection
  { id: 'e-center-project', source: 'get-center',     target: 'project-target',  sourceHandle: 'value',       targetHandle: 'from' },
  // projected location → send target
  { id: 'e-project-send',  source: 'project-target',  target: 'send-target',     sourceHandle: 'location',    targetHandle: 'location' },
  // Gate's true output triggers send-target each tick
  { id: 'e-gate-send',     source: 'gate-active',     target: 'send-target',     sourceHandle: 'true_out',    targetHandle: 'trigger' },
];
