import { t } from '../../i18n';
/**
 * AHRS_ORIENTATION, in words a person can act on.
 *
 * The parameter is the same on copter, plane and rover, and its stock labels
 * ("Yaw270Roll180") describe a rotation rather than a mounting, which is why
 * people guess. The common mountings are named here; the rest stay available
 * in a full list.
 */

export interface BoardOrientation {
  value: number;
  /** ArduPilot's own name, so a value looked up elsewhere still matches. */
  code: string;
  label: string;
  hint?: string;
}

/** What people actually mount. Order is deliberate: upright, upside down, then
 * the quarter turns, which is roughly how often each one happens. */
export const COMMON_ORIENTATIONS: BoardOrientation[] = [
  { value: 0, code: 'None', get label() { return t('mavlink_config.board_orientation.uprightArrowForward'); }, get hint() { return t('mavlink_config.board_orientation.factoryDefault'); } },
  { value: 8, code: 'Roll180', get label() { return t('mavlink_config.board_orientation.upsideDownArrowForward'); }, get hint() { return t('mavlink_config.board_orientation.boardFlippedOver'); } },
  { value: 2, code: 'Yaw90', get label() { return t('mavlink_config.board_orientation.uprightArrowRight'); } },
  { value: 4, code: 'Yaw180', get label() { return t('mavlink_config.board_orientation.uprightArrowBackward'); } },
  { value: 6, code: 'Yaw270', get label() { return t('mavlink_config.board_orientation.uprightArrowLeft'); } },
  { value: 10, code: 'Yaw90Roll180', get label() { return t('mavlink_config.board_orientation.upsideDownArrowRight'); } },
  { value: 12, code: 'Pitch180', get label() { return t('mavlink_config.board_orientation.upsideDownArrowBackward'); } },
  { value: 14, code: 'Yaw270Roll180', get label() { return t('mavlink_config.board_orientation.upsideDownArrowLeft'); } },
  { value: 16, code: 'Roll90', get label() { return t('mavlink_config.board_orientation.onItsRightEdge'); } },
  { value: 20, code: 'Roll270', get label() { return t('mavlink_config.board_orientation.onItsLeftEdge'); } },
  // Pitch90 turns the arrow up (positive pitch is nose up), Pitch270 down.
  { value: 24, code: 'Pitch90', get label() { return t('mavlink_config.board_orientation.standingArrowUp'); } },
  { value: 25, code: 'Pitch270', get label() { return t('mavlink_config.board_orientation.standingArrowDown'); } },
];

/** Every value ArduPilot accepts, for the cases the common list does not name. */
export const ALL_ORIENTATIONS: Record<number, string> = {
  0: 'None', 1: 'Yaw45', 2: 'Yaw90', 3: 'Yaw135', 4: 'Yaw180', 5: 'Yaw225',
  6: 'Yaw270', 7: 'Yaw315', 8: 'Roll180', 9: 'Yaw45Roll180', 10: 'Yaw90Roll180',
  11: 'Yaw135Roll180', 12: 'Pitch180', 13: 'Yaw225Roll180', 14: 'Yaw270Roll180',
  15: 'Yaw315Roll180', 16: 'Roll90', 17: 'Yaw45Roll90', 18: 'Yaw90Roll90',
  19: 'Yaw135Roll90', 20: 'Roll270', 21: 'Yaw45Roll270', 22: 'Yaw90Roll270',
  23: 'Yaw135Roll270', 24: 'Pitch90', 25: 'Pitch270', 26: 'Yaw90Pitch180',
  27: 'Yaw270Pitch180', 28: 'Pitch90Roll90', 29: 'Pitch90Roll180',
  30: 'Pitch90Roll270', 31: 'Pitch180Roll90', 32: 'Pitch180Roll270',
  33: 'Pitch270Roll90', 34: 'Pitch270Roll180', 35: 'Pitch270Roll270',
  36: 'Yaw90Pitch180Roll90', 37: 'Yaw270Roll90', 38: 'Yaw293Pitch68Roll180',
  39: 'Pitch315', 40: 'Pitch315Roll90', 42: 'Roll45', 43: 'Roll315',
  get 100() { return t('mavlink_config.board_orientation.custom41AndOlder'); }, get 101() { return t('mavlink_config.board_orientation.custom1'); }, get 102() { return t('mavlink_config.board_orientation.custom2'); },
};

export function orientationName(value: number): string {
  const common = COMMON_ORIENTATIONS.find((o) => o.value === value);
  if (common) return common.label;
  return ALL_ORIENTATIONS[value] ?? `Value ${value}`;
}

/**
 * The check that catches a wrong choice on the bench: with the board mounted
 * as declared, tipping the vehicle nose up must read pitch up, and rolling it
 * right must read roll right. A sign flip here is the classic upside-down
 * mounting left at 0.
 */
export function orientationCheck(
  roll: number,
  pitch: number,
): { level: boolean; note: string } {
  const level = Math.abs(roll) < 5 && Math.abs(pitch) < 5;
  return {
    level,
    note: level
      ? t('mavlink_config.board_orientation.readingLevelTipTheNoseUp')
      : t('mavlink_config.board_orientation.readingRollPitchIfTheVehicle', { v1: Math.round(roll), v2: Math.round(pitch) }),
  };
}

/** Rotation encoded in an ArduPilot orientation name, in degrees. The names are
 * built from the rotations themselves ("Yaw270Roll180"), so the picture can be
 * drawn from the name instead of a hand-kept table of 46 transforms. */
export function orientationRotation(value: number): { yaw: number; pitch: number; roll: number } {
  const code = ALL_ORIENTATIONS[value] ?? '';
  const part = (axis: string) => Number(new RegExp(`${axis}(\\d+)`).exec(code)?.[1] ?? 0);
  return { yaw: part('Yaw'), pitch: part('Pitch'), roll: part('Roll') };
}

/** True when the board ends up with its top face pointing down. */
export function isInverted(value: number): boolean {
  const { roll, pitch } = orientationRotation(value);
  return roll === 180 || pitch === 180;
}
