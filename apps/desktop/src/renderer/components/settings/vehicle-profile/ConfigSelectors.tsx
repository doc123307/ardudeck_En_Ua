import type { VehicleProfile, WingShape, VtolStyle, MotorArrangement } from '../../../stores/settings-store.js';
import { t } from '../../../i18n';

interface ConfigSelectorsProps {
  vehicle: VehicleProfile;
  onUpdate: (updates: Partial<VehicleProfile>) => void;
}

const WING_SHAPES: Array<{ value: WingShape; label: string; hint: string }> = [
  { value: 'standard',     get label() { return t('settings.ConfigSelectors.standard'); },      get hint() { return t('settings.ConfigSelectors.traditionalFuselageWithSeparateElevatorRudder'); } },
  { value: 'delta',        get label() { return t('settings.ConfigSelectors.delta'); },         get hint() { return t('settings.ConfigSelectors.triangularWingElevonsCombinePitchRoll'); } },
  { value: 'flying-wing',  get label() { return t('settings.ConfigSelectors.flyingWing'); },   get hint() { return t('settings.ConfigSelectors.noTailWingOnlyElevonsFor'); } },
  { value: 'v-tail',       get label() { return t('settings.ConfigSelectors.vTail'); },        get hint() { return t('settings.ConfigSelectors.twoSurfacesMixPitchAndYaw'); } },
  { value: 'biplane',      get label() { return t('settings.ConfigSelectors.biplane'); },       get hint() { return t('settings.ConfigSelectors.twoWingsStackedRareNostalgic'); } },
  { value: 'inverted-v',   get label() { return t('settings.ConfigSelectors.invertedV'); },    get hint() { return t('settings.ConfigSelectors.invertedVTail'); } },
];

const VTOL_STYLES: Array<{ value: VtolStyle; label: string; hint: string }> = [
  { value: 'quadplane',   get label() { return t('settings.ConfigSelectors.quadplane'); },    get hint() { return t('settings.ConfigSelectors.planeSeparateVerticalLiftMotors'); } },
  { value: 'tailsitter',  get label() { return t('settings.ConfigSelectors.tailsitter'); },   get hint() { return t('settings.ConfigSelectors.sitsOnItsTailTiltsTo'); } },
  { value: 'tiltrotor',   get label() { return t('settings.ConfigSelectors.tiltrotor'); },    get hint() { return t('settings.ConfigSelectors.motorsTiltFromVerticalToHorizontal'); } },
  { value: 'tiltwing',    get label() { return t('settings.ConfigSelectors.tiltwing'); },     get hint() { return t('settings.ConfigSelectors.wholeWingTiltsWithTheMotors'); } },
];

const MOTOR_ARRANGEMENTS: Array<{ value: MotorArrangement; label: string; hint: string }> = [
  { value: 'quad-x',       get label() { return t('settings.ConfigSelectors.quadX'); },       get hint() { return t('settings.ConfigSelectors.n4MotorsInXPattern'); } },
  { value: 'quad-plus',    get label() { return t('settings.ConfigSelectors.quad'); },       get hint() { return t('settings.ConfigSelectors.n4MotorsInPattern'); } },
  { value: 'quad-h',       get label() { return t('settings.ConfigSelectors.quadH'); },       get hint() { return t('settings.ConfigSelectors.n4MotorsInHPattern'); } },
  { value: 'hex-x',        get label() { return t('settings.ConfigSelectors.hexX'); },        get hint() { return t('settings.ConfigSelectors.n6MotorsInXPattern'); } },
  { value: 'hex-plus',     get label() { return t('settings.ConfigSelectors.hex'); },        get hint() { return t('settings.ConfigSelectors.n6MotorsInPattern'); } },
  { value: 'octo-x',       get label() { return t('settings.ConfigSelectors.octoX'); },       get hint() { return t('settings.ConfigSelectors.n8MotorsInXPattern'); } },
  { value: 'octo-plus',    get label() { return t('settings.ConfigSelectors.octo'); },       get hint() { return t('settings.ConfigSelectors.n8MotorsInPattern'); } },
  { value: 'y6',           label: 'Y6',           get hint() { return t('settings.ConfigSelectors.n3Arms2CoaxialMotorsEach'); } },
  { value: 'tri',          get label() { return t('settings.ConfigSelectors.tricopter'); },    get hint() { return t('settings.ConfigSelectors.n3MotorsYawServo'); } },
  { value: 'coaxial',      get label() { return t('settings.ConfigSelectors.coaxialX8'); },   get hint() { return t('settings.ConfigSelectors.n4CoaxialPairsStacked'); } },
  { value: 'inline-2',     get label() { return t('settings.ConfigSelectors.inline2'); },     get hint() { return t('settings.ConfigSelectors.n2MotorsSideBySide'); } },
  { value: 'twin-tractor', get label() { return t('settings.ConfigSelectors.twinTractor'); }, get hint() { return t('settings.ConfigSelectors.n2MotorsPullingFromWingLe'); } },
  { value: 'twin-pusher',  get label() { return t('settings.ConfigSelectors.twinPusher'); },  get hint() { return t('settings.ConfigSelectors.n2MotorsPushingFromWingTe'); } },
];

/**
 * The three orthogonal configuration selectors + live param-hint row.
 * Only renders what's relevant for the vehicle type.
 */
export function ConfigSelectors({ vehicle, onUpdate }: ConfigSelectorsProps) {
  const showWing = vehicle.type === 'plane' || vehicle.type === 'vtol';
  const showVtol = vehicle.type === 'vtol';
  const showMotor = vehicle.type === 'copter' || vehicle.type === 'vtol';

  if (!showWing && !showVtol && !showMotor) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      {showWing && (
        <Selector
          label={t('settings.ConfigSelectors.wingShape')}
          value={vehicle.wingShape}
          options={WING_SHAPES}
          onChange={v => onUpdate({ wingShape: v as WingShape })}
        />
      )}
      {showVtol && (
        <Selector
          label={t('settings.ConfigSelectors.vtolStyle')}
          value={vehicle.vtolStyle}
          options={VTOL_STYLES}
          onChange={v => onUpdate({ vtolStyle: v as VtolStyle })}
        />
      )}
      {showMotor && (
        <Selector
          label={t('settings.ConfigSelectors.motorArrangement')}
          value={vehicle.motorArrangement}
          options={MOTOR_ARRANGEMENTS}
          onChange={v => onUpdate({ motorArrangement: v as MotorArrangement })}
        />
      )}
    </div>
  );
}

interface SelectorProps<T extends string> {
  label: string;
  value: T | undefined;
  options: Array<{ value: T; label: string; hint: string }>;
  onChange: (value: T) => void;
}

function Selector<T extends string>({ label, value, options, onChange }: SelectorProps<T>) {
  const current = options.find(o => o.value === value);
  return (
    <div>
      <label className="block text-sm font-medium text-content mb-1.5">{label}</label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value as T)}
        className="w-full px-3 py-2 bg-surface-input border border-border rounded-lg text-content focus:outline-none focus:border-blue-500"
      >
        <option value="">{t('settings.ConfigSelectors.select')}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {current && (
        <div className="text-[10px] text-content-secondary mt-1">{current.hint}</div>
      )}
    </div>
  );
}

