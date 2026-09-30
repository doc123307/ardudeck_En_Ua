/**
 * ServoAssignmentStep
 *
 * Step 2: Assign servos to control surfaces with visual diagram.
 */

import { useState } from 'react';
import { useServoWizardStore } from '../../../stores/servo-wizard-store';
import { CONTROL_SURFACE_INFO, ControlSurface } from '../presets/servo-presets';
import AircraftDiagram from '../diagrams/AircraftDiagram';
import { AlertTriangle } from 'lucide-react';
import { t } from '../../../i18n';

export default function ServoAssignmentStep() {
  const {
    selectedPresetId,
    selectedPreset,
    assignments,
    updateAssignment,
    nextStep,
    prevStep,
  } = useServoWizardStore();

  const [highlightedSurface, setHighlightedSurface] = useState<ControlSurface | null>(null);

  if (!selectedPreset || !selectedPresetId) {
    return <div className="text-content-secondary">{t('servo_wizard.ServoAssignmentStep.noAircraftTypeSelected')}</div>;
  }

  // Build servo labels for the diagram
  const servoLabels: Record<ControlSurface, string> = {} as Record<ControlSurface, string>;
  assignments.forEach((a) => {
    servoLabels[a.surface] = `S${a.servoIndex}`;
  });

  // Get available servo indices (0-8)
  const availableServos = Array.from({ length: 9 }, (_, i) => i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-content">{t('servo_wizard.ServoAssignmentStep.assignServosToControlSurfaces')}</h2>
        <p className="text-sm text-content-secondary mt-2">
          {t('servo_wizard.ServoAssignmentStep.matchEachControlSurfaceToThe')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Diagram */}
        <div className="bg-surface-input rounded-xl border border-subtle p-6">
          <AircraftDiagram
            presetId={selectedPresetId}
            highlightSurface={highlightedSurface}
            onSurfaceClick={(surface) => setHighlightedSurface(surface)}
            servoLabels={servoLabels}
          />
          <p className="text-xs text-content-secondary text-center mt-4">
            {t('servo_wizard.ServoAssignmentStep.clickAControlSurfaceToHighlight')}
          </p>
        </div>

        {/* Assignment table */}
        <div className="space-y-3">
          <div className="bg-surface-raised rounded-lg p-3 mb-4">
            <p className="text-xs text-content-secondary">
              <strong className="text-content">{t('servo_wizard.ServoAssignmentStep.tip')}</strong> {t('servo_wizard.ServoAssignmentStep.checkYourFcWiringServoOutputs')}
            </p>
          </div>

          {assignments.map((assignment, index) => {
            const surfaceInfo = CONTROL_SURFACE_INFO[assignment.surface];
            const isHighlighted = highlightedSurface === assignment.surface;

            return (
              <div
                key={assignment.surface}
                className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                  isHighlighted
                    ? 'bg-blue-500/20 border border-blue-500/50'
                    : 'bg-surface border border-subtle'
                }`}
                onMouseEnter={() => setHighlightedSurface(assignment.surface)}
                onMouseLeave={() => setHighlightedSurface(null)}
              >
                {/* Surface name */}
                <div className="flex-1">
                  <div className="text-sm font-medium text-content">{surfaceInfo.name}</div>
                  <div className="text-xs text-content-secondary">{surfaceInfo.description}</div>
                </div>

                {/* Servo selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-content-secondary">{t('servo_wizard.ServoAssignmentStep.servo')}</span>
                  <select
                    value={assignment.servoIndex}
                    onChange={(e) =>
                      updateAssignment(index, { servoIndex: Number(e.target.value) })
                    }
                    className="w-20 px-3 py-2 bg-surface-raised border border rounded-lg text-sm text-content focus:outline-none focus:border-blue-500"
                  >
                    {availableServos.map((servo) => (
                      <option key={servo} value={servo}>
                        S{servo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}

          {/* Warning if duplicate servos */}
          {hasDuplicateServos(assignments) && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-yellow-400">
                {t('servo_wizard.ServoAssignmentStep.warningMultipleSurfacesAssignedToThe')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={prevStep}
          className="px-6 py-2.5 rounded-lg font-medium bg-surface-raised text-content hover:bg-surface-raised"
        >
          {t('servo_wizard.ServoAssignmentStep.back')}
        </button>
        <button
          onClick={nextStep}
          className="px-6 py-2.5 rounded-lg font-medium bg-blue-500 text-white hover:bg-blue-400"
        >
          {t('servo_wizard.ServoAssignmentStep.continueTestServos')}
        </button>
      </div>
    </div>
  );
}

// Helper to check for duplicate servo assignments
function hasDuplicateServos(
  assignments: { servoIndex: number }[]
): boolean {
  const indices = assignments.map((a) => a.servoIndex);
  return new Set(indices).size !== indices.length;
}
