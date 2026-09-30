/**
 * ServoTestStep
 *
 * Step 3: Live test servos with reverse buttons.
 * Move transmitter sticks and verify servos respond correctly.
 */

import { useServoWizardStore } from '../../../stores/servo-wizard-store';
import { CONTROL_SURFACE_INFO } from '../presets/servo-presets';
import ServoBar from '../shared/ServoBar';
import { Check, Lightbulb } from 'lucide-react';
import { t } from '../../../i18n';

export default function ServoTestStep() {
  const {
    assignments,
    servoValues,
    isPollingServos,
    reverseServo,
    startServoPolling,
    stopServoPolling,
    nextStep,
    prevStep,
  } = useServoWizardStore();

  // Get servo value for an assignment
  const getServoValue = (servoIndex: number) => {
    return servoValues[servoIndex] || 1500;
  };

  // Determine if servo is moving (not near center)
  const isServoMoving = (value: number) => {
    return Math.abs(value - 1500) > 50;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-content">{t('servo_wizard.ServoTestStep.testYourServos')}</h2>
        <p className="text-sm text-content-secondary mt-2">
          {t('servo_wizard.ServoTestStep.moveYourTransmitterSticksAndVerify')}
          <br />
          {t('servo_wizard.ServoTestStep.ifAServoMovesThe')} <strong className="text-content">{t('servo_wizard.ServoTestStep.wrongWay')}</strong>{t('servo_wizard.ServoTestStep.click')} <strong className="text-blue-400">{t('servo_wizard.ServoTestStep.reverse')}</strong>.
        </p>
      </div>

      {/* Polling status */}
      <div className="flex items-center justify-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPollingServos}
            onChange={(e) => (e.target.checked ? startServoPolling() : stopServoPolling())}
            className="w-4 h-4 rounded border bg-surface-raised text-blue-500 focus:ring-blue-500/50"
          />
          <span className="text-sm text-content-secondary">
            {isPollingServos ? (
              <span className="text-green-400">{t('servo_wizard.ServoTestStep.liveServoPollingEnabled')}</span>
            ) : (
              t('servo_wizard.ServoTestStep.enableLiveServoPolling')
            )}
          </span>
        </label>
      </div>

      {/* Servo test cards */}
      <div className="space-y-4">
        {assignments.map((assignment, index) => {
          const surfaceInfo = CONTROL_SURFACE_INFO[assignment.surface];
          const value = getServoValue(assignment.servoIndex);
          const moving = isServoMoving(value);

          return (
            <div
              key={assignment.surface}
              className={`bg-surface-input rounded-xl border p-4 transition-all ${
                moving
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-subtle'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-content">{surfaceInfo.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-surface-raised rounded text-content-secondary">
                      {t('servo_wizard.ServoTestStep.servo')} {assignment.servoIndex}
                    </span>
                    {assignment.reversed && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-500/20 rounded text-yellow-400">
                        {t('servo_wizard.ServoTestStep.reversed')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-content-secondary mt-1">
                    {getServoTestInstruction(assignment.surface)}
                  </div>
                </div>
                <button
                  onClick={() => reverseServo(index)}
                  className={`px-4 py-2 text-sm rounded-lg transition-all ${
                    assignment.reversed
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
                  }`}
                >
                  {assignment.reversed ? t('servo_wizard.ServoTestStep.undoReverse') : t('servo_wizard.ServoTestStep.reverse')}
                </button>
              </div>

              {/* Servo bar */}
              <ServoBar
                value={value}
                min={assignment.min}
                max={assignment.max}
                center={assignment.center}
                showLabels={false}
                height={20}
              />

              {/* Status indicator */}
              <div className="mt-2 flex items-center gap-2">
                {moving ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400">{t('servo_wizard.ServoTestStep.servoIsResponding')}</span>
                  </>
                ) : (
                  <>
                    <span className="text-content-secondary">○</span>
                    <span className="text-xs text-content-secondary">{t('servo_wizard.ServoTestStep.moveStickToTest')}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help tip */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />
        <div>
          <p className="text-sm text-amber-400 font-medium">{t('servo_wizard.ServoTestStep.howToCheckDirection')}</p>
          <ul className="text-xs text-content-secondary mt-1 space-y-1 list-disc list-inside">
            <li><strong>{t('servo_wizard.ServoTestStep.ailerons')}</strong> {t('servo_wizard.ServoTestStep.rollStickRightRightAileronShould')}</li>
            <li><strong>{t('servo_wizard.ServoTestStep.elevator')}</strong> {t('servo_wizard.ServoTestStep.pullStickBackTrailingEdgeShould')}</li>
            <li><strong>{t('servo_wizard.ServoTestStep.rudder')}</strong> {t('servo_wizard.ServoTestStep.yawStickRightRudderShouldMove')}</li>
            <li><strong>{t('servo_wizard.ServoTestStep.elevons')}</strong> {t('servo_wizard.ServoTestStep.testBothRollAndPitchMovements')}</li>
          </ul>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={prevStep}
          className="px-6 py-2.5 rounded-lg font-medium bg-surface-raised text-content hover:bg-surface-raised"
        >
          {t('servo_wizard.ServoTestStep.back')}
        </button>
        <button
          onClick={nextStep}
          className="px-6 py-2.5 rounded-lg font-medium bg-blue-500 text-white hover:bg-blue-400"
        >
          {t('servo_wizard.ServoTestStep.continueCalibrate')}
        </button>
      </div>
    </div>
  );
}

// Get test instruction for a control surface
function getServoTestInstruction(surface: string): string {
  switch (surface) {
    case 'aileron_left':
      return 'Move roll stick RIGHT → this servo should move DOWN';
    case 'aileron_right':
      return 'Move roll stick RIGHT → this servo should move UP';
    case 'elevator':
      return 'Pull pitch stick BACK → trailing edge should go UP';
    case 'rudder':
      return 'Move yaw stick RIGHT → rudder should deflect RIGHT';
    case 'elevon_left':
      return 'Roll RIGHT → DOWN. Pitch BACK → UP (trailing edge)';
    case 'elevon_right':
      return 'Roll RIGHT → UP. Pitch BACK → UP (trailing edge)';
    case 'vtail_left':
      return 'Pitch BACK and Yaw RIGHT → test both movements';
    case 'vtail_right':
      return 'Pitch BACK and Yaw RIGHT → test both movements';
    case 'yaw_servo':
      return 'Move yaw stick → motor should tilt';
    case 'gimbal_pan':
      return 'Move yaw stick → camera should rotate horizontally';
    case 'gimbal_tilt':
      return 'Move pitch stick → camera should tilt up/down';
    default:
      return 'Move the corresponding stick';
  }
}
