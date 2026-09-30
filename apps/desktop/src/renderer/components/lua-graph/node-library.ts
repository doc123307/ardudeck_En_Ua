/**
 * Node library — defines every available node type for the Lua Graph Editor.
 */
import type { NodeDefinition, PortDefinition } from './lua-graph-types';
import { t } from '../../i18n';

// ── Sensors ─────────────────────────────────────────────────────

const sensorNodes: NodeDefinition[] = [
  {
    type: 'sensor-gps',
    get label() { return t('lua_graph.node_library.gpsPosition'); },
    get description() { return t('lua_graph.node_library.currentGpsCoordinatesFromTheFlight'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'lat', get label() { return t('lua_graph.node_library.latitude'); }, type: 'number', direction: 'output' },
      { id: 'lng', get label() { return t('lua_graph.node_library.longitude'); }, type: 'number', direction: 'output' },
      { id: 'alt', get label() { return t('lua_graph.node_library.altitudeM'); }, type: 'number', direction: 'output' },
    ],
    properties: [],
    luaTemplate: 'gps:location(0)',
  },
  {
    type: 'sensor-baro-alt',
    get label() { return t('lua_graph.node_library.baroAltitude'); },
    get description() { return t('lua_graph.node_library.barometricAltitudeInMeters'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'alt_m', get label() { return t('lua_graph.node_library.altitudeM'); }, type: 'number', direction: 'output' },
    ],
    properties: [],
    luaTemplate: 'baro:get_altitude()',
  },
  {
    type: 'sensor-battery',
    get label() { return t('lua_graph.node_library.battery'); },
    get description() { return t('lua_graph.node_library.batteryVoltageCurrentAndRemainingPercentage'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'voltage', get label() { return t('lua_graph.node_library.voltage'); }, type: 'number', direction: 'output' },
      { id: 'current', get label() { return t('lua_graph.node_library.currentA'); }, type: 'number', direction: 'output' },
      { id: 'remaining_pct', get label() { return t('lua_graph.node_library.remaining'); }, type: 'number', direction: 'output' },
    ],
    properties: [
      { id: 'instance', get label() { return t('lua_graph.node_library.batteryInstance'); }, type: 'number', defaultValue: 0, min: 0, max: 3 },
    ],
    luaTemplate: 'battery',
  },
  {
    type: 'sensor-airspeed',
    get label() { return t('lua_graph.node_library.airspeed'); },
    get description() { return t('lua_graph.node_library.measuredAirspeedInMS'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'airspeed_ms', get label() { return t('lua_graph.node_library.airspeedMS'); }, type: 'number', direction: 'output' },
    ],
    properties: [],
    luaTemplate: 'ahrs:airspeed_estimate()',
  },
  {
    type: 'sensor-rc-channel',
    get label() { return t('lua_graph.node_library.rcChannel'); },
    get description() { return t('lua_graph.node_library.readASpecificRcChannelValue'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'value_us', get label() { return t('lua_graph.node_library.valueUs'); }, type: 'number', direction: 'output' },
    ],
    properties: [
      { id: 'channel', get label() { return t('lua_graph.node_library.channel'); }, type: 'channel', defaultValue: 1, min: 1, max: 16 },
    ],
    luaTemplate: 'rc:get_pwm(CH)',
  },
  {
    type: 'sensor-rangefinder',
    get label() { return t('lua_graph.node_library.rangefinder'); },
    get description() { return t('lua_graph.node_library.rangefinderDistanceInMeters'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'distance_m', get label() { return t('lua_graph.node_library.distanceM'); }, type: 'number', direction: 'output' },
    ],
    properties: [
      { id: 'instance', get label() { return t('lua_graph.node_library.instance'); }, type: 'number', defaultValue: 0, min: 0, max: 3 },
    ],
    luaTemplate: 'rangefinder:distance_cm(INST) / 100.0',
  },
  {
    type: 'sensor-attitude',
    get label() { return t('lua_graph.node_library.attitude'); },
    get description() { return t('lua_graph.node_library.currentVehicleAttitudeRollPitchYaw'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'roll', get label() { return t('lua_graph.node_library.rollDeg'); }, type: 'number', direction: 'output' },
      { id: 'pitch', get label() { return t('lua_graph.node_library.pitchDeg'); }, type: 'number', direction: 'output' },
      { id: 'yaw', get label() { return t('lua_graph.node_library.yawDeg'); }, type: 'number', direction: 'output' },
    ],
    properties: [],
    luaTemplate: 'ahrs:get_roll/pitch/yaw()',
  },
  {
    type: 'sensor-groundspeed',
    get label() { return t('lua_graph.node_library.groundSpeed'); },
    get description() { return t('lua_graph.node_library.gpsGroundSpeedInMS'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'speed_ms', get label() { return t('lua_graph.node_library.speedMS'); }, type: 'number', direction: 'output' },
    ],
    properties: [],
    luaTemplate: 'ahrs:groundspeed_vector()',
  },
  {
    type: 'sensor-rc-aux-switch',
    get label() { return t('lua_graph.node_library.rcAuxSwitch'); },
    get description() { return t('lua_graph.node_library.readAnRcAuxSwitchPosition'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'state', get label() { return t('lua_graph.node_library.state02'); }, type: 'number', direction: 'output' },
      { id: 'is_high', get label() { return t('lua_graph.node_library.isHigh'); }, type: 'boolean', direction: 'output' },
      { id: 'is_mid', get label() { return t('lua_graph.node_library.isMid'); }, type: 'boolean', direction: 'output' },
      { id: 'is_low', get label() { return t('lua_graph.node_library.isLow'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [
      { id: 'aux_fn', get label() { return t('lua_graph.node_library.auxFunction'); }, type: 'number', defaultValue: 300, min: 0, max: 999 },
    ],
    luaTemplate: 'rc:get_aux_cached(FN)',
  },
  {
    type: 'sensor-rangefinder-orient',
    get label() { return t('lua_graph.node_library.rangefinderOriented'); },
    get description() { return t('lua_graph.node_library.rangefinderDistanceWithOrientationEG'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'distance_m', get label() { return t('lua_graph.node_library.distanceM'); }, type: 'number', direction: 'output' },
    ],
    properties: [
      {
        id: 'orientation', get label() { return t('lua_graph.node_library.orientation'); }, type: 'select', defaultValue: 25,
        options: [
          { label: '0 Forward', value: 0 },
          { label: '25 Down', value: 25 },
          { label: '24 Up', value: 24 },
        ],
      },
    ],
    luaTemplate: 'rangefinder:distance_cm_orient(ORIENT) / 100.0',
  },
  {
    type: 'sensor-flight-mode',
    get label() { return t('lua_graph.node_library.flightMode'); },
    get description() { return t('lua_graph.node_library.currentFlightModeNumberFromThe'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'mode_num', get label() { return t('lua_graph.node_library.modeNumber'); }, type: 'number', direction: 'output' },
    ],
    properties: [],
    luaTemplate: 'vehicle:get_mode()',
  },
  {
    type: 'sensor-armed',
    get label() { return t('lua_graph.node_library.armedState'); },
    get description() { return t('lua_graph.node_library.whetherTheVehicleIsCurrentlyArmed'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'is_armed', get label() { return t('lua_graph.node_library.isArmed'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [],
    luaTemplate: 'arming:is_armed()',
  },
  {
    type: 'sensor-gps-status',
    get label() { return t('lua_graph.node_library.gpsStatus'); },
    get description() { return t('lua_graph.node_library.gpsFixTypeAndSatelliteCount'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'fix_type', get label() { return t('lua_graph.node_library.fixType06'); }, type: 'number', direction: 'output' },
      { id: 'num_sats', get label() { return t('lua_graph.node_library.satellites'); }, type: 'number', direction: 'output' },
      { id: 'has_3d_fix', get label() { return t('lua_graph.node_library.has3dFix'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [
      { id: 'instance', get label() { return t('lua_graph.node_library.gpsInstance'); }, type: 'number', defaultValue: 0, min: 0, max: 1 },
    ],
    luaTemplate: 'gps:status(INST)',
  },
  {
    type: 'sensor-home',
    get label() { return t('lua_graph.node_library.homePosition'); },
    get description() { return t('lua_graph.node_library.homeLocationCoordinatesAndAltitudeExposes'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'location', get label() { return t('lua_graph.node_library.location'); }, type: 'any', direction: 'output' },
      { id: 'lat', get label() { return t('lua_graph.node_library.latitude'); }, type: 'number', direction: 'output' },
      { id: 'lng', get label() { return t('lua_graph.node_library.longitude'); }, type: 'number', direction: 'output' },
      { id: 'alt', get label() { return t('lua_graph.node_library.altitudeM'); }, type: 'number', direction: 'output' },
    ],
    properties: [],
    luaTemplate: 'ahrs:get_home()',
  },
  {
    type: 'sensor-ahrs-location',
    get label() { return t('lua_graph.node_library.ahrsLocation'); },
    get description() { return t('lua_graph.node_library.liveVehicleLocationFromAhrsA'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'location', get label() { return t('lua_graph.node_library.location'); }, type: 'any', direction: 'output' },
    ],
    properties: [],
    luaTemplate: 'ahrs:get_location()',
  },
  {
    type: 'sensor-named-float',
    get label() { return t('lua_graph.node_library.readNamedFloat'); },
    get description() { return t('lua_graph.node_library.readANamedValueFloatPublished'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'number', direction: 'output' },
      { id: 'fresh', get label() { return t('lua_graph.node_library.fresh'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [
      { id: 'name', get label() { return t('lua_graph.node_library.nameMax10Chars'); }, type: 'string', defaultValue: 'AD_HB' },
    ],
  },
  {
    type: 'sensor-velocity-ned',
    get label() { return t('lua_graph.node_library.velocityNed'); },
    get description() { return t('lua_graph.node_library.vehicleVelocityInNorthEastDown'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'vel_n', get label() { return t('lua_graph.node_library.northMS'); }, type: 'number', direction: 'output' },
      { id: 'vel_e', get label() { return t('lua_graph.node_library.eastMS'); }, type: 'number', direction: 'output' },
      { id: 'vel_d', get label() { return t('lua_graph.node_library.downMS'); }, type: 'number', direction: 'output' },
    ],
    properties: [],
    luaTemplate: 'ahrs:get_velocity_NED()',
  },
  {
    type: 'sensor-wind',
    get label() { return t('lua_graph.node_library.windEstimate'); },
    get description() { return t('lua_graph.node_library.estimatedWindSpeedAndDirection'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'speed_ms', get label() { return t('lua_graph.node_library.speedMS'); }, type: 'number', direction: 'output' },
      { id: 'dir_deg', get label() { return t('lua_graph.node_library.directionDeg'); }, type: 'number', direction: 'output' },
    ],
    properties: [],
    luaTemplate: 'ahrs:wind_estimate()',
  },
  {
    type: 'sensor-param-get',
    get label() { return t('lua_graph.node_library.readParameter'); },
    get description() { return t('lua_graph.node_library.readAFlightControllerParameterLive'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'number', direction: 'output' },
    ],
    properties: [
      { id: 'param_name', get label() { return t('lua_graph.node_library.parameterName'); }, type: 'string', defaultValue: 'CAM1_TRIGG_DIST' },
    ],
    luaTemplate: 'param:get(NAME)',
  },
  {
    type: 'sensor-gpio-read',
    get label() { return t('lua_graph.node_library.readGpioPin'); },
    get description() { return t('lua_graph.node_library.readTheDigitalLevelOfA'); },
    category: 'sensors',
    inputs: [
      { id: 'pin', get label() { return t('lua_graph.node_library.pin'); }, type: 'number', direction: 'input' },
    ],
    outputs: [
      { id: 'level', get label() { return t('lua_graph.node_library.level01'); }, type: 'number', direction: 'output' },
      { id: 'is_high', get label() { return t('lua_graph.node_library.isHigh'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [
      { id: 'pin', get label() { return t('lua_graph.node_library.pinFallback'); }, type: 'number', defaultValue: 54, min: 0, max: 255 },
    ],
    luaTemplate: 'gpio:read(PIN)',
  },
  {
    type: 'sensor-pwm-pulse',
    get label() { return t('lua_graph.node_library.pulseInputInterrupt'); },
    get description() { return t('lua_graph.node_library.catchShortPulsesEGA'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'pulse_seen', get label() { return t('lua_graph.node_library.pulseSeen'); }, type: 'boolean', direction: 'output' },
      { id: 'width_us', get label() { return t('lua_graph.node_library.widthUs'); }, type: 'number', direction: 'output' },
      { id: 'ok', get label() { return t('lua_graph.node_library.pinOk'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [
      { id: 'pin', get label() { return t('lua_graph.node_library.pin'); }, type: 'number', defaultValue: 54, min: 0, max: 255 },
    ],
    luaTemplate: 'PWMSource():get_pwm_us()',
  },
  {
    type: 'sensor-current-waypoint',
    get label() { return t('lua_graph.node_library.currentWaypoint'); },
    get description() { return t('lua_graph.node_library.theActiveMissionNavigationWaypointIndex'); },
    category: 'sensors',
    inputs: [],
    outputs: [
      { id: 'index', get label() { return t('lua_graph.node_library.index'); }, type: 'number', direction: 'output' },
      { id: 'nav_id', get label() { return t('lua_graph.node_library.commandId'); }, type: 'number', direction: 'output' },
    ],
    properties: [],
    luaTemplate: 'mission:get_current_nav_index()',
  },
];

// ── Logic ───────────────────────────────────────────────────────

const logicNodes: NodeDefinition[] = [
  {
    type: 'logic-compare',
    get label() { return t('lua_graph.node_library.compare'); },
    get description() { return t('lua_graph.node_library.compareTwoNumbersWithASelected'); },
    category: 'logic',
    inputs: [
      { id: 'a', label: 'A', type: 'number', direction: 'input', defaultValue: 0 },
      { id: 'b', label: 'B', type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [
      { id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [
      {
        id: 'operator', get label() { return t('lua_graph.node_library.operator'); }, type: 'select', defaultValue: '>',
        options: [
          { get label() { return t('lua_graph.node_library.greaterThan'); }, value: '>' },
          { get label() { return t('lua_graph.node_library.lessThan'); }, value: '<' },
          { get label() { return t('lua_graph.node_library.equalTo'); }, value: '==' },
          { get label() { return t('lua_graph.node_library.notEqualTo'); }, value: '~=' },
          { get label() { return t('lua_graph.node_library.greaterOrEqual'); }, value: '>=' },
          { get label() { return t('lua_graph.node_library.lessOrEqual'); }, value: '<=' },
        ],
      },
    ],
  },
  {
    type: 'logic-if-else',
    get label() { return t('lua_graph.node_library.ifElse'); },
    get description() { return t('lua_graph.node_library.branchExecutionBasedOnABoolean'); },
    category: 'logic',
    inputs: [
      { id: 'condition', get label() { return t('lua_graph.node_library.condition'); }, type: 'boolean', direction: 'input' },
    ],
    outputs: [
      { id: 'true_out', get label() { return t('lua_graph.node_library.true'); }, type: 'boolean', direction: 'output' },
      { id: 'false_out', get label() { return t('lua_graph.node_library.false'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [],
  },
  {
    type: 'logic-and',
    label: 'AND',
    get description() { return t('lua_graph.node_library.logicalAndTrueOnlyIfBoth'); },
    category: 'logic',
    inputs: [
      { id: 'a', label: 'A', type: 'boolean', direction: 'input' },
      { id: 'b', label: 'B', type: 'boolean', direction: 'input' },
    ],
    outputs: [
      { id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [],
  },
  {
    type: 'logic-or',
    label: 'OR',
    get description() { return t('lua_graph.node_library.logicalOrTrueIfEitherInput'); },
    category: 'logic',
    inputs: [
      { id: 'a', label: 'A', type: 'boolean', direction: 'input' },
      { id: 'b', label: 'B', type: 'boolean', direction: 'input' },
    ],
    outputs: [
      { id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [],
  },
  {
    type: 'logic-not',
    label: 'NOT',
    get description() { return t('lua_graph.node_library.invertABooleanValue'); },
    category: 'logic',
    inputs: [
      { id: 'input', get label() { return t('lua_graph.node_library.input'); }, type: 'boolean', direction: 'input' },
    ],
    outputs: [
      { id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [],
  },
  {
    type: 'logic-range-check',
    get label() { return t('lua_graph.node_library.rangeCheck'); },
    get description() { return t('lua_graph.node_library.checkIfAValueIsWithin'); },
    category: 'logic',
    inputs: [
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'number', direction: 'input' },
    ],
    outputs: [
      { id: 'in_range', get label() { return t('lua_graph.node_library.inRange'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [
      { id: 'min', get label() { return t('lua_graph.node_library.min'); }, type: 'number', defaultValue: 0 },
      { id: 'max', get label() { return t('lua_graph.node_library.max'); }, type: 'number', defaultValue: 100 },
    ],
  },
  {
    type: 'logic-switch',
    get label() { return t('lua_graph.node_library.switch'); },
    get description() { return t('lua_graph.node_library.multiBranchBasedOnANumeric'); },
    category: 'logic',
    inputs: [
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'number', direction: 'input' },
    ],
    outputs: [
      { id: 'case_0', get label() { return t('lua_graph.node_library.case0'); }, type: 'boolean', direction: 'output' },
      { id: 'case_1', get label() { return t('lua_graph.node_library.case1'); }, type: 'boolean', direction: 'output' },
      { id: 'case_2', get label() { return t('lua_graph.node_library.case2'); }, type: 'boolean', direction: 'output' },
      { id: 'default', get label() { return t('lua_graph.node_library.default'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [
      { id: 'case0_val', get label() { return t('lua_graph.node_library.case0Value'); }, type: 'number', defaultValue: 0 },
      { id: 'case1_val', get label() { return t('lua_graph.node_library.case1Value'); }, type: 'number', defaultValue: 1 },
      { id: 'case2_val', get label() { return t('lua_graph.node_library.case2Value'); }, type: 'number', defaultValue: 2 },
    ],
  },
];

// ── Math ────────────────────────────────────────────────────────

const mathNodes: NodeDefinition[] = [
  {
    type: 'math-add',
    get label() { return t('lua_graph.node_library.add'); },
    get description() { return t('lua_graph.node_library.addTwoNumbersAB'); },
    category: 'math',
    inputs: [
      { id: 'a', label: 'A', type: 'number', direction: 'input', defaultValue: 0 },
      { id: 'b', label: 'B', type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [{ id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'number', direction: 'output' }],
    properties: [],
  },
  {
    type: 'math-subtract',
    get label() { return t('lua_graph.node_library.subtract'); },
    get description() { return t('lua_graph.node_library.subtractTwoNumbersAB'); },
    category: 'math',
    inputs: [
      { id: 'a', label: 'A', type: 'number', direction: 'input', defaultValue: 0 },
      { id: 'b', label: 'B', type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [{ id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'number', direction: 'output' }],
    properties: [],
  },
  {
    type: 'math-multiply',
    get label() { return t('lua_graph.node_library.multiply'); },
    get description() { return t('lua_graph.node_library.multiplyTwoNumbersAB'); },
    category: 'math',
    inputs: [
      { id: 'a', label: 'A', type: 'number', direction: 'input', defaultValue: 0 },
      { id: 'b', label: 'B', type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [{ id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'number', direction: 'output' }],
    properties: [],
  },
  {
    type: 'math-divide',
    get label() { return t('lua_graph.node_library.divide'); },
    get description() { return t('lua_graph.node_library.divideTwoNumbersABWith'); },
    category: 'math',
    inputs: [
      { id: 'a', label: 'A', type: 'number', direction: 'input', defaultValue: 0 },
      { id: 'b', label: 'B', type: 'number', direction: 'input', defaultValue: 1 },
    ],
    outputs: [{ id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'number', direction: 'output' }],
    properties: [],
  },
  {
    type: 'math-clamp',
    get label() { return t('lua_graph.node_library.clamp'); },
    get description() { return t('lua_graph.node_library.constrainAValueToAMin'); },
    category: 'math',
    inputs: [
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [{ id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'number', direction: 'output' }],
    properties: [
      { id: 'min', get label() { return t('lua_graph.node_library.min'); }, type: 'number', defaultValue: 0 },
      { id: 'max', get label() { return t('lua_graph.node_library.max'); }, type: 'number', defaultValue: 100 },
    ],
  },
  {
    type: 'math-map-range',
    get label() { return t('lua_graph.node_library.mapRange'); },
    get description() { return t('lua_graph.node_library.linearInterpolationFromOneRangeTo'); },
    category: 'math',
    inputs: [
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [{ id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'number', direction: 'output' }],
    properties: [
      { id: 'in_min', get label() { return t('lua_graph.node_library.inputMin'); }, type: 'number', defaultValue: 0 },
      { id: 'in_max', get label() { return t('lua_graph.node_library.inputMax'); }, type: 'number', defaultValue: 100 },
      { id: 'out_min', get label() { return t('lua_graph.node_library.outputMin'); }, type: 'number', defaultValue: 0 },
      { id: 'out_max', get label() { return t('lua_graph.node_library.outputMax'); }, type: 'number', defaultValue: 1 },
    ],
  },
  {
    type: 'math-abs',
    get label() { return t('lua_graph.node_library.abs'); },
    get description() { return t('lua_graph.node_library.absoluteValueOfANumber'); },
    category: 'math',
    inputs: [
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [{ id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'number', direction: 'output' }],
    properties: [],
  },
  {
    type: 'math-min',
    get label() { return t('lua_graph.node_library.min'); },
    get description() { return t('lua_graph.node_library.minimumOfTwoValues'); },
    category: 'math',
    inputs: [
      { id: 'a', label: 'A', type: 'number', direction: 'input', defaultValue: 0 },
      { id: 'b', label: 'B', type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [{ id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'number', direction: 'output' }],
    properties: [],
  },
  {
    type: 'math-max',
    get label() { return t('lua_graph.node_library.max'); },
    get description() { return t('lua_graph.node_library.maximumOfTwoValues'); },
    category: 'math',
    inputs: [
      { id: 'a', label: 'A', type: 'number', direction: 'input', defaultValue: 0 },
      { id: 'b', label: 'B', type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [{ id: 'result', get label() { return t('lua_graph.node_library.result'); }, type: 'number', direction: 'output' }],
    properties: [],
  },
  // ── Location math (work with AHRS Location objects) ──
  {
    type: 'math-location-bearing',
    get label() { return t('lua_graph.node_library.bearingAB'); },
    get description() { return t('lua_graph.node_library.compassBearingInDegreesFromLocation'); },
    category: 'math',
    inputs: [
      { id: 'from', get label() { return t('lua_graph.node_library.from'); }, type: 'any', direction: 'input' },
      { id: 'to', label: 'To', type: 'any', direction: 'input' },
    ],
    outputs: [{ id: 'bearing_deg', get label() { return t('lua_graph.node_library.bearing'); }, type: 'number', direction: 'output' }],
    properties: [],
    luaTemplate: 'math.deg(FROM:get_bearing(TO))',
  },
  {
    type: 'math-location-distance',
    get label() { return t('lua_graph.node_library.distanceAB'); },
    get description() { return t('lua_graph.node_library.horizontalDistanceInMetresBetweenTwo'); },
    category: 'math',
    inputs: [
      { id: 'a', label: 'A', type: 'any', direction: 'input' },
      { id: 'b', label: 'B', type: 'any', direction: 'input' },
    ],
    outputs: [{ id: 'distance_m', get label() { return t('lua_graph.node_library.distanceM'); }, type: 'number', direction: 'output' }],
    properties: [],
    luaTemplate: 'A:get_distance(B)',
  },
  {
    type: 'math-location-offset',
    get label() { return t('lua_graph.node_library.offsetLocation'); },
    get description() { return t('lua_graph.node_library.projectALocationForwardByBearing'); },
    category: 'math',
    inputs: [
      { id: 'from', get label() { return t('lua_graph.node_library.from'); }, type: 'any', direction: 'input' },
      { id: 'bearing_deg', get label() { return t('lua_graph.node_library.bearing'); }, type: 'number', direction: 'input', defaultValue: 0 },
      { id: 'distance_m', get label() { return t('lua_graph.node_library.distanceM'); }, type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [{ id: 'location', get label() { return t('lua_graph.node_library.location'); }, type: 'any', direction: 'output' }],
    properties: [],
    luaTemplate: 'FROM:copy():offset_bearing(BEARING, DISTANCE)',
  },
];

// ── Actions ─────────────────────────────────────────────────────

const actionNodes: NodeDefinition[] = [
  {
    type: 'action-gcs-text',
    get label() { return t('lua_graph.node_library.sendGcsText'); },
    get description() { return t('lua_graph.node_library.displayAMessageOnTheGround'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
    ],
    outputs: [],
    properties: [
      { id: 'message', get label() { return t('lua_graph.node_library.message'); }, type: 'string', defaultValue: 'Hello from Lua!' },
      {
        id: 'severity', get label() { return t('lua_graph.node_library.severity'); }, type: 'select', defaultValue: 6,
        options: [
          { get label() { return t('lua_graph.node_library.emergency'); }, value: 0 },
          { get label() { return t('lua_graph.node_library.alert'); }, value: 1 },
          { get label() { return t('lua_graph.node_library.critical'); }, value: 2 },
          { get label() { return t('lua_graph.node_library.error'); }, value: 3 },
          { get label() { return t('lua_graph.node_library.warning'); }, value: 4 },
          { get label() { return t('lua_graph.node_library.notice'); }, value: 5 },
          { get label() { return t('lua_graph.node_library.info'); }, value: 6 },
          { get label() { return t('lua_graph.node_library.debug'); }, value: 7 },
        ],
      },
    ],
    luaTemplate: 'gcs:send_text(SEV, MSG)',
  },
  {
    type: 'action-set-servo',
    get label() { return t('lua_graph.node_library.setServo'); },
    get description() { return t('lua_graph.node_library.setAServoOutputToA'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
      { id: 'pwm', label: 'PWM', type: 'number', direction: 'input', defaultValue: 1500 },
    ],
    outputs: [],
    properties: [
      { id: 'servo_num', get label() { return t('lua_graph.node_library.servoNumber'); }, type: 'number', defaultValue: 1, min: 1, max: 16 },
    ],
    luaTemplate: 'SRV_Channels:set_output_pwm(CH, PWM)',
  },
  {
    type: 'action-set-mode',
    get label() { return t('lua_graph.node_library.setFlightMode'); },
    get description() { return t('lua_graph.node_library.requestAFlightModeChange'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
    ],
    outputs: [],
    properties: [
      { id: 'mode_num', get label() { return t('lua_graph.node_library.modeNumber'); }, type: 'number', defaultValue: 0, min: 0, max: 30 },
    ],
    luaTemplate: 'vehicle:set_mode(MODE)',
  },
  {
    type: 'action-set-param',
    get label() { return t('lua_graph.node_library.setParameter'); },
    get description() { return t('lua_graph.node_library.changeAFlightControllerParameterValue'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [],
    properties: [
      { id: 'param_name', get label() { return t('lua_graph.node_library.parameterName'); }, type: 'string', defaultValue: 'RC1_MIN' },
    ],
    luaTemplate: 'param:set(NAME, VAL)',
  },
  {
    type: 'action-relay',
    get label() { return t('lua_graph.node_library.triggerRelay'); },
    get description() { return t('lua_graph.node_library.toggleARelayOnOrOff'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
    ],
    outputs: [],
    properties: [
      { id: 'relay_num', get label() { return t('lua_graph.node_library.relayNumber'); }, type: 'number', defaultValue: 0, min: 0, max: 5 },
      {
        id: 'state', get label() { return t('lua_graph.node_library.state'); }, type: 'select', defaultValue: 1,
        options: [{ label: 'ON', value: 1 }, { label: 'OFF', value: 0 }],
      },
    ],
    luaTemplate: 'relay:on/off(NUM)',
  },
  {
    type: 'action-log-to-file',
    get label() { return t('lua_graph.node_library.logToFile'); },
    get description() { return t('lua_graph.node_library.appendALineOfDataTo'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
      { id: 'value1', get label() { return t('lua_graph.node_library.value1'); }, type: 'any', direction: 'input' },
      { id: 'value2', get label() { return t('lua_graph.node_library.value2'); }, type: 'any', direction: 'input' },
      { id: 'value3', get label() { return t('lua_graph.node_library.value3'); }, type: 'any', direction: 'input' },
    ],
    outputs: [],
    properties: [
      { id: 'filename', get label() { return t('lua_graph.node_library.fileName'); }, type: 'string', defaultValue: 'log.csv' },
      {
        id: 'separator', get label() { return t('lua_graph.node_library.separator'); }, type: 'select', defaultValue: ',',
        options: [
          { get label() { return t('lua_graph.node_library.commaCsv'); }, value: ',' },
          { get label() { return t('lua_graph.node_library.semicolon'); }, value: ';' },
          { get label() { return t('lua_graph.node_library.tab'); }, value: '\t' },
        ],
      },
    ],
    luaTemplate: 'io.open/write/close',
  },
  {
    type: 'action-set-led',
    get label() { return t('lua_graph.node_library.setLed'); },
    get description() { return t('lua_graph.node_library.controlNeopixelProfiledColors'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
      { id: 'r', get label() { return t('lua_graph.node_library.red'); }, type: 'number', direction: 'input', defaultValue: 0 },
      { id: 'g', get label() { return t('lua_graph.node_library.green'); }, type: 'number', direction: 'input', defaultValue: 0 },
      { id: 'b', get label() { return t('lua_graph.node_library.blue'); }, type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [],
    properties: [
      { id: 'instance', get label() { return t('lua_graph.node_library.ledInstance'); }, type: 'number', defaultValue: 0, min: 0, max: 15 },
    ],
    luaTemplate: 'serialLED:set_RGB(INST, LED, R, G, B)',
  },
  {
    type: 'action-play-tune',
    get label() { return t('lua_graph.node_library.playTune'); },
    get description() { return t('lua_graph.node_library.playAToneMelodyOnThe'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
    ],
    outputs: [],
    properties: [
      { id: 'tune', get label() { return t('lua_graph.node_library.tuneMml'); }, type: 'string', defaultValue: 'MFT200L4O5CDE' },
    ],
    luaTemplate: 'notify:play_tune(TUNE)',
  },
  {
    type: 'action-set-waypoint',
    get label() { return t('lua_graph.node_library.jumpToWaypoint'); },
    get description() { return t('lua_graph.node_library.setTheCurrentMissionCommandIndex'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
    ],
    outputs: [],
    properties: [
      { id: 'cmd_idx', get label() { return t('lua_graph.node_library.waypointIndex'); }, type: 'number', defaultValue: 1, min: 0, max: 999 },
    ],
    luaTemplate: 'mission:set_current_cmd(IDX)',
  },
  // ── FC-side script primitives (added for the script-installer graph) ──
  {
    type: 'action-set-target-location',
    get label() { return t('lua_graph.node_library.setTargetLocation'); },
    get description() { return t('lua_graph.node_library.issueAGuidedModePositionTarget'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
      { id: 'location', get label() { return t('lua_graph.node_library.location'); }, type: 'any', direction: 'input' },
    ],
    outputs: [],
    properties: [],
    luaTemplate: 'vehicle:set_target_location(LOCATION)',
  },
  {
    type: 'action-publish-named-float',
    get label() { return t('lua_graph.node_library.publishNamedFloat'); },
    get description() { return t('lua_graph.node_library.sendANamedValueFloatMax'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'number', direction: 'input', defaultValue: 0 },
    ],
    outputs: [],
    properties: [
      { id: 'name', get label() { return t('lua_graph.node_library.nameMax10Chars'); }, type: 'string', defaultValue: 'AD_HB' },
    ],
    luaTemplate: 'gcs:send_named_float("NAME", VALUE)',
  },
  {
    type: 'action-mavlink-on-user-cmd',
    get label() { return t('lua_graph.node_library.onMavCmdUser'); },
    get description() { return t('lua_graph.node_library.receiveAMavlinkUserCommandMav'); },
    category: 'actions',
    inputs: [],
    outputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.onCmd'); }, type: 'boolean', direction: 'output' },
      { id: 'param1', label: 'param1', type: 'number', direction: 'output' },
      { id: 'param2', label: 'param2', type: 'number', direction: 'output' },
      { id: 'param3', label: 'param3', type: 'number', direction: 'output' },
      { id: 'param4', label: 'param4', type: 'number', direction: 'output' },
      { id: 'location', get label() { return t('lua_graph.node_library.location'); }, type: 'any', direction: 'output' },
    ],
    properties: [
      {
        id: 'cmd_id', label: 'MAV_CMD ID', type: 'select', defaultValue: 31010,
        options: [
          { label: 'USER_1 (31010)', value: 31010 },
          { label: 'USER_2 (31011)', value: 31011 },
          { label: 'USER_3 (31012)', value: 31012 },
          { label: 'USER_4 (31013)', value: 31013 },
          { label: 'USER_5 (31014)', value: 31014 },
        ],
      },
    ],
  },
  {
    type: 'action-serial-write',
    get label() { return t('lua_graph.node_library.serialWrite'); },
    get description() { return t('lua_graph.node_library.writeAStringOutAScripting'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
      { id: 'data', get label() { return t('lua_graph.node_library.data'); }, type: 'any', direction: 'input' },
    ],
    outputs: [],
    properties: [
      { id: 'instance', get label() { return t('lua_graph.node_library.scriptingSerialInstance'); }, type: 'number', defaultValue: 0, min: 0, max: 3 },
      {
        id: 'baud', get label() { return t('lua_graph.node_library.baudRate'); }, type: 'select', defaultValue: 57600,
        options: [
          { label: '9600', value: 9600 },
          { label: '19200', value: 19200 },
          { label: '38400', value: 38400 },
          { label: '57600', value: 57600 },
          { label: '115200', value: 115200 },
          { label: '230400', value: 230400 },
          { label: '460800', value: 460800 },
          { label: '921600', value: 921600 },
        ],
      },
      {
        id: 'line_ending', get label() { return t('lua_graph.node_library.lineEnding'); }, type: 'select', defaultValue: 'none',
        options: [
          { get label() { return t('lua_graph.node_library.none'); }, value: 'none' },
          { get label() { return t('lua_graph.node_library.newlineN'); }, value: 'lf' },
          { get label() { return t('lua_graph.node_library.crlfRN'); }, value: 'crlf' },
        ],
      },
    ],
    luaTemplate: 'port:write(byte)',
  },
  {
    type: 'action-socket-send',
    get label() { return t('lua_graph.node_library.networkSend'); },
    get description() { return t('lua_graph.node_library.sendAStringOverUdpOr'); },
    category: 'actions',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
      { id: 'data', get label() { return t('lua_graph.node_library.data'); }, type: 'any', direction: 'input' },
    ],
    outputs: [],
    properties: [
      {
        id: 'protocol', get label() { return t('lua_graph.node_library.protocol'); }, type: 'select', defaultValue: 'udp',
        options: [
          { label: 'UDP', value: 'udp' },
          { label: 'TCP', value: 'tcp' },
        ],
      },
      { id: 'ip', get label() { return t('lua_graph.node_library.destinationIp'); }, type: 'string', defaultValue: '192.168.1.10' },
      { id: 'port', get label() { return t('lua_graph.node_library.destinationPort'); }, type: 'number', defaultValue: 14550, min: 1, max: 65535 },
    ],
    luaTemplate: 'sock:send(data, #data)',
  },
];

// ── Timing ──────────────────────────────────────────────────────

const timingNodes: NodeDefinition[] = [
  {
    type: 'timing-run-every',
    get label() { return t('lua_graph.node_library.runEvery'); },
    get description() { return t('lua_graph.node_library.executeDownstreamAtAFixedInterval'); },
    category: 'timing',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
    ],
    outputs: [
      { id: 'flow', get label() { return t('lua_graph.node_library.flow'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [
      { id: 'interval_ms', get label() { return t('lua_graph.node_library.intervalMs'); }, type: 'number', defaultValue: 5000, min: 100, max: 60000, step: 100 },
    ],
  },
  {
    type: 'timing-debounce',
    get label() { return t('lua_graph.node_library.debounce'); },
    get description() { return t('lua_graph.node_library.suppressRapidChangesOnlyPassThrough'); },
    category: 'timing',
    inputs: [
      { id: 'input', get label() { return t('lua_graph.node_library.input'); }, type: 'boolean', direction: 'input' },
    ],
    outputs: [
      { id: 'output', get label() { return t('lua_graph.node_library.output'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [
      { id: 'delay_ms', get label() { return t('lua_graph.node_library.delayMs'); }, type: 'number', defaultValue: 500, min: 50, max: 10000 },
    ],
  },
  {
    type: 'timing-on-change',
    get label() { return t('lua_graph.node_library.onChange'); },
    get description() { return t('lua_graph.node_library.triggerWhenAValueChangesFrom'); },
    category: 'timing',
    inputs: [
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'number', direction: 'input' },
    ],
    outputs: [
      { id: 'changed', get label() { return t('lua_graph.node_library.changed'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [],
  },
  {
    type: 'timing-rising-edge',
    get label() { return t('lua_graph.node_library.risingEdge'); },
    get description() { return t('lua_graph.node_library.firesOnceWhenInputTransitionsFrom'); },
    category: 'timing',
    inputs: [
      { id: 'input', get label() { return t('lua_graph.node_library.input'); }, type: 'boolean', direction: 'input' },
    ],
    outputs: [
      { id: 'triggered', get label() { return t('lua_graph.node_library.triggered'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [],
  },
  {
    type: 'timing-falling-edge',
    get label() { return t('lua_graph.node_library.fallingEdge'); },
    get description() { return t('lua_graph.node_library.firesOnceWhenInputTransitionsFrom2'); },
    category: 'timing',
    inputs: [
      { id: 'input', get label() { return t('lua_graph.node_library.input'); }, type: 'boolean', direction: 'input' },
    ],
    outputs: [
      { id: 'triggered', get label() { return t('lua_graph.node_library.triggered'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [],
  },
  {
    type: 'timing-watchdog',
    get label() { return t('lua_graph.node_library.watchdogTimer'); },
    get description() { return t('lua_graph.node_library.outputsExpiredIfNoKickIs'); },
    category: 'timing',
    inputs: [
      { id: 'kick', get label() { return t('lua_graph.node_library.kick'); }, type: 'boolean', direction: 'input' },
      { id: 'enable', get label() { return t('lua_graph.node_library.enable'); }, type: 'boolean', direction: 'input', defaultValue: true },
    ],
    outputs: [
      { id: 'expired', get label() { return t('lua_graph.node_library.expired'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [
      { id: 'timeout_ms', get label() { return t('lua_graph.node_library.timeoutMs'); }, type: 'number', defaultValue: 3000, min: 100, max: 120000, step: 100 },
    ],
  },
  {
    type: 'timing-latch',
    get label() { return t('lua_graph.node_library.latchToggle'); },
    get description() { return t('lua_graph.node_library.setResetFlipFlopSetTurns'); },
    category: 'timing',
    inputs: [
      { id: 'set', get label() { return t('lua_graph.node_library.set'); }, type: 'boolean', direction: 'input' },
      { id: 'reset', get label() { return t('lua_graph.node_library.reset'); }, type: 'boolean', direction: 'input' },
    ],
    outputs: [
      { id: 'state', get label() { return t('lua_graph.node_library.state'); }, type: 'boolean', direction: 'output' },
    ],
    properties: [],
  },
];

// ── Variables ───────────────────────────────────────────────────

const variableNodes: NodeDefinition[] = [
  {
    type: 'var-constant',
    get label() { return t('lua_graph.node_library.constant'); },
    get description() { return t('lua_graph.node_library.aFixedValueNumberStringOr'); },
    category: 'variables',
    inputs: [],
    outputs: [
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'any', direction: 'output' },
    ],
    properties: [
      {
        id: 'type', get label() { return t('lua_graph.node_library.type'); }, type: 'select', defaultValue: 'number',
        options: [
          { get label() { return t('lua_graph.node_library.number'); }, value: 'number' },
          { get label() { return t('lua_graph.node_library.string'); }, value: 'string' },
          { get label() { return t('lua_graph.node_library.boolean'); }, value: 'boolean' },
        ],
      },
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'string', defaultValue: '0' },
    ],
  },
  {
    type: 'var-get',
    get label() { return t('lua_graph.node_library.getVariable'); },
    get description() { return t('lua_graph.node_library.readANamedVariable'); },
    category: 'variables',
    inputs: [],
    outputs: [
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'any', direction: 'output' },
    ],
    properties: [
      { id: 'name', get label() { return t('lua_graph.node_library.variableName'); }, type: 'string', defaultValue: 'myVar' },
    ],
  },
  {
    type: 'var-set',
    get label() { return t('lua_graph.node_library.setVariable'); },
    get description() { return t('lua_graph.node_library.writeANamedVariable'); },
    category: 'variables',
    inputs: [
      { id: 'trigger', get label() { return t('lua_graph.node_library.trigger'); }, type: 'boolean', direction: 'input' },
      { id: 'value', get label() { return t('lua_graph.node_library.value'); }, type: 'any', direction: 'input' },
    ],
    outputs: [],
    properties: [
      { id: 'name', get label() { return t('lua_graph.node_library.variableName'); }, type: 'string', defaultValue: 'myVar' },
    ],
  },
];

// ── Flow ────────────────────────────────────────────────────────

const flowNodes: NodeDefinition[] = [
  {
    type: 'flow-custom-lua',
    get label() { return t('lua_graph.node_library.customLua'); },
    get description() { return t('lua_graph.node_library.inlineYourOwnLuaSnippetInput'); },
    category: 'flow',
    // Ports are derived per-instance from the pin properties, see getEffectivePorts
    inputs: [],
    outputs: [],
    properties: [
      { id: 'inputs', get label() { return t('lua_graph.node_library.inputPinsCommaSeparated'); }, type: 'string', defaultValue: '' },
      { id: 'outputs', get label() { return t('lua_graph.node_library.outputPinsCommaSeparated'); }, type: 'string', defaultValue: '' },
      { id: 'code', get label() { return t('lua_graph.node_library.luaCode'); }, type: 'code', defaultValue: '-- inputs are locals named after your input pins\n-- return values in output pin order' },
    ],
  },
  {
    type: 'flow-comment',
    get label() { return t('lua_graph.node_library.comment'); },
    get description() { return t('lua_graph.node_library.aTextCommentForDocumentationPurposes'); },
    category: 'flow',
    inputs: [],
    outputs: [],
    properties: [
      { id: 'text', get label() { return t('lua_graph.node_library.comment'); }, type: 'string', defaultValue: 'Add a description here...' },
    ],
  },
];

// ── Registry ────────────────────────────────────────────────────

export const NODE_LIBRARY: NodeDefinition[] = [
  ...sensorNodes,
  ...logicNodes,
  ...mathNodes,
  ...actionNodes,
  ...timingNodes,
  ...variableNodes,
  ...flowNodes,
];

/** Lookup map: type → definition */
const definitionMap = new Map<string, NodeDefinition>();
for (const def of NODE_LIBRARY) {
  definitionMap.set(def.type, def);
}

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return definitionMap.get(type);
}

/** Get all nodes in a given category */
export function getNodesByCategory(category: string): NodeDefinition[] {
  return NODE_LIBRARY.filter((n) => n.category === category);
}

// ── Dynamic ports (Custom Lua) ──────────────────────────────────

const LUA_KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while',
]);

/** Parse a comma-separated pin list into unique valid Lua identifiers */
export function parseCustomPins(raw: string): string[] {
  const seen = new Set<string>();
  const pins: string[] = [];
  for (const part of raw.split(',')) {
    let name = part.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
    if (LUA_KEYWORDS.has(name)) name = `${name}_`;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    pins.push(name);
  }
  return pins;
}

/**
 * Ports for a node instance. Static for every node except Custom Lua, whose
 * pins come from its own pin-list properties.
 */
export function getEffectivePorts(
  def: NodeDefinition,
  propertyValues: Record<string, number | boolean | string>,
): { inputs: PortDefinition[]; outputs: PortDefinition[] } {
  if (def.type !== 'flow-custom-lua') {
    return { inputs: def.inputs, outputs: def.outputs };
  }
  const toPorts = (raw: unknown, direction: PortDefinition['direction']): PortDefinition[] =>
    parseCustomPins(String(raw ?? '')).map((name) => ({
      id: name,
      label: name,
      type: 'any' as const,
      direction,
    }));
  return {
    inputs: toPorts(propertyValues['inputs'], 'input'),
    outputs: toPorts(propertyValues['outputs'], 'output'),
  };
}
