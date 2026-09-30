/**
 * Built-in survey generator self-registration.
 *
 * Importing this module is sufficient to populate the survey generator
 * registry with the bundled generators (grid, crosshatch, circular,
 * spiral, perimeter-fill). The survey-store imports this once at
 * module load.
 */

import { registerSurveyGenerator } from '../generator-registry';
import { generateGrid } from './grid-generator';
import { generateCrosshatch } from './crosshatch-generator';
import { generateCircular } from './circular-generator';
import { generateSpiral } from './spiral-generator';
import { generatePerimeterFill } from './perimeter-fill-generator';
import { generateCorridor } from './corridor-generator';
import { generatePanorama } from './panorama-generator';
import { t } from '../../../i18n';

registerSurveyGenerator({
  id: 'builtin.grid',
  version: '1.0.0',
  displayName: 'Grid',
  get description() { return t('survey.index.boustrophedonLawnmowerPatternParallelScanLines'); },
  capabilities: {
    supportsHoles: true,
    supportsWorkspace: false,
    requiresCamera: true,
    isAsync: false,
    isRemote: false,
  },
  generate: generateGrid,
});

registerSurveyGenerator({
  id: 'builtin.crosshatch',
  version: '1.0.0',
  get displayName() { return t('survey.index.crosshatch'); },
  get description() { return t('survey.index.twoPerpendicularGridPassesHigherPhoto'); },
  capabilities: {
    supportsHoles: true,
    supportsWorkspace: false,
    requiresCamera: true,
    isAsync: false,
    isRemote: false,
  },
  generate: generateCrosshatch,
});

registerSurveyGenerator({
  id: 'builtin.circular',
  version: '1.0.0',
  get displayName() { return t('survey.index.circular'); },
  get description() { return t('survey.index.orbitAPointOfInterestAt'); },
  capabilities: {
    supportsHoles: false,
    supportsWorkspace: false,
    requiresCamera: true,
    isAsync: false,
    isRemote: false,
  },
  generate: generateCircular,
});

registerSurveyGenerator({
  id: 'builtin.spiral',
  version: '1.0.0',
  get displayName() { return t('survey.index.spiral'); },
  get description() { return t('survey.index.inwardOrOutwardSpiralWithinThe'); },
  capabilities: {
    supportsHoles: false,
    supportsWorkspace: false,
    requiresCamera: true,
    isAsync: false,
    isRemote: false,
  },
  generate: generateSpiral,
});

registerSurveyGenerator({
  id: 'builtin.corridor',
  version: '1.0.0',
  get displayName() { return t('survey.index.corridor'); },
  get description() { return t('survey.index.linearSurveyAlongACenterlineRoads'); },
  capabilities: {
    supportsHoles: false,
    supportsWorkspace: false,
    requiresCamera: true,
    isAsync: false,
    isRemote: false,
  },
  generate: generateCorridor,
});

registerSurveyGenerator({
  id: 'builtin.panorama',
  version: '1.0.0',
  get displayName() { return t('survey.index.panorama'); },
  get description() { return t('survey.index.captureALineShorelineCliffFrontage'); },
  capabilities: {
    supportsHoles: false,
    supportsWorkspace: false,
    requiresCamera: true,
    isAsync: false,
    isRemote: false,
  },
  generate: generatePanorama,
});

registerSurveyGenerator({
  id: 'builtin.perimeter-fill',
  version: '1.0.0',
  get displayName() { return t('survey.index.perimeterFill'); },
  get description() { return t('survey.index.nPerimeterPassesFollowedByA'); },
  capabilities: {
    supportsHoles: false,
    supportsWorkspace: false,
    requiresCamera: true,
    isAsync: false,
    isRemote: false,
  },
  generate: generatePerimeterFill,
});
