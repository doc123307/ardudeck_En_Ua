import type { FeatureTour, FeatureTourStep } from './types';
import { useConfigTabMenuStore } from '../stores/config-tab-menu-store';
import { useWorkspaceDialogStore } from '../stores/workspace-dialog-store';
import { useSurveyMenuStore } from '../stores/survey-menu-store';
import { useParameterStore } from '../stores/parameter-store';
import { hasDualVtolControllers } from '../components/mavlink-config/mavlink-pid-schemes';
import { t as tr } from '../i18n';

// Feature tours are the per-release "what's new" walkthroughs. They are NOT
// version-gated at runtime (TourManager shows any registry tour the user hasn't
// seen for the current view), so stale tours keep prompting until removed here.
//
// One tour per SCREEN so a walkthrough never jumps the user between views. Each
// step's `predicate` skips it when its anchor isn't in the DOM (e.g. no groups
// yet), so a tour degrades gracefully instead of pointing at nothing.
const present = (selector: string) => () => !!document.querySelector(selector);

function TourText({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      <p className="text-xs leading-relaxed opacity-90">{children}</p>
    </div>
  );
}

/** A configuration tab group, with its dropdown opened so the sub-tabs are in the highlight. */
function groupStep(groupId: string, title: string, body: React.ReactNode): FeatureTourStep {
  const anchor = `[data-tour="mavlink-tab-group-${groupId}"]`;
  return {
    selector: anchor,
    predicate: present(anchor),
    setup: () => useConfigTabMenuStore.getState().setOpenGroupId(groupId),
    // reactour only refreshes when an added node matches, so observe this group's menu itself.
    highlightedSelectors: [`[data-tour="mavlink-tab-menu-${groupId}"]`],
    mutationObservables: [`[data-tour^="mavlink-tab-menu-"]`],
    content: <TourText title={title}>{body}</TourText>,
  };
}

/** A configuration tab that is not in a group on this vehicle. */
function itemStep(tabId: string, title: string, body: React.ReactNode): FeatureTourStep {
  const anchor = `[data-tour="mavlink-tab-${tabId}"]`;
  return {
    selector: anchor,
    predicate: present(anchor),
    setup: () => useConfigTabMenuStore.getState().setOpenGroupId(null),
    mutationObservables: [`[data-tour^="mavlink-tab-menu-"]`],
    content: <TourText title={title}>{body}</TourText>,
  };
}

export const FEATURE_TOURS: FeatureTour[] = [
  {
    id: 'mission-planning-alpha32',
    view: 'mission',
    version: '0.0.32',
    get title() { return tr('feature_tours.registry.missionPlanningLeveledUp'); },
    get blurb() { return tr('feature_tours.registry.groupedMissionsCorridorSurveysGsdFirst'); },
    cleanup: () => useSurveyMenuStore.getState().setOpen(false),
    steps: [
      {
        selector: '[data-tour="mission-group"]',
        predicate: present('[data-tour="mission-group"]'),
        setup: () => useSurveyMenuStore.getState().setOpen(false),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.missionsAreOrganizedIntoGroups')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.everyWaypointNowLivesInA')} <strong>{tr('feature_tours.registry.group')}</strong>{tr('feature_tours.registry.clickTheSwatchToRecolorThe')}
              {' '}<strong>{tr('feature_tours.registry.distanceFlightTimeAndGsd')}</strong> {tr('feature_tours.registry.atAGlance')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="mission-survey"]',
        predicate: present('[data-tour="mission-survey"]'),
        setup: () => useSurveyMenuStore.getState().setOpen(true),
        highlightedSelectors: ['[data-tour="mission-survey-menu"]'],
        mutationObservables: ['[data-tour="mission-survey-menu"]'],
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.corridorSurveys')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.underThe')} <strong>{tr('feature_tours.registry.survey')}</strong> {tr('feature_tours.registry.buttonPick')} <strong>{tr('feature_tours.registry.corridor')}</strong> {tr('feature_tours.registry.forLinearJobsRoadsRailPower')} <strong>{tr('feature_tours.registry.plane')}</strong> {tr('feature_tours.registry.racetrackTurnsAtSharpBendsOr')} <strong>{tr('feature_tours.registry.copter')}</strong> {tr('feature_tours.registry.turnsOnTheSpotAndSet')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="mission-survey"]',
        predicate: present('[data-tour="mission-survey"]'),
        setup: () => useSurveyMenuStore.getState().setOpen(true),
        highlightedSelectors: ['[data-tour="mission-survey-menu"]'],
        mutationObservables: ['[data-tour="mission-survey-menu"]'],
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.smarterAreaSurveys')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.planBy')} <strong>GSD</strong> {tr('feature_tours.registry.cmPxInsteadOfGuessingAltitude')}
              {' '}<strong>{tr('feature_tours.registry.batteryAndData')}</strong> {tr('feature_tours.registry.estimatesAndSplitABigJob')}
              {' '}<strong>{tr('feature_tours.registry.batterySizedSorties')}</strong> {tr('feature_tours.registry.inOneClickCrosshatchCanEven')} <strong>{tr('feature_tours.registry.twoDifferentHeights')}</strong> {tr('feature_tours.registry.forBetter3d')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="mission-import"]',
        predicate: present('[data-tour="mission-import"]'),
        setup: () => useSurveyMenuStore.getState().setOpen(false),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.importAnAreaFromGis')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.bringASurveyBoundaryStraightIn')} <strong>KML</strong>, <strong>KMZ</strong> {tr('feature_tours.registry.or')}
              {' '}<strong>GeoJSON</strong> {tr('feature_tours.registry.oneSurveyGroupPerPolygonInner')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="mission-export"]',
        predicate: present('[data-tour="mission-export"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.exportInAnyFormat')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.saveOrExportTheWholeMission')} <strong>{tr('feature_tours.registry.waypoints')}</strong> {tr('feature_tours.registry.qgcWplForArdupilotMissionPlanner')} <strong>{tr('feature_tours.registry.plan')}</strong> {tr('feature_tours.registry.qgroundcontrolPickTheFormatUpFront')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="mission-history"]',
        predicate: present('[data-tour="mission-history"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.undoRedoAndCrashRecovery')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.full')} <strong>{tr('feature_tours.registry.undoRedo')}</strong> {tr('feature_tours.registry.cmdCtrlZAcrossEditsPlus')}
              {' '}<strong>{tr('feature_tours.registry.autosave')}</strong> {tr('feature_tours.registry.ifTheAppClosesMidPlan')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'vtol-dual-controller-tuning-alpha32',
    view: 'parameters',
    version: '0.0.32',
    get title() { return tr('feature_tours.registry.tuneVtolAndFixedWingSeparately'); },
    get blurb() { return tr('feature_tours.registry.quadplanesCarryTwoControllerSetsThe'); },
    // Only offer this on a QuadPlane that exposes both control-law sets; on any
    // other vehicle the switch does not exist, so the tour stays hidden.
    predicate: () => hasDualVtolControllers(useParameterStore.getState().parameters),
    steps: [
      {
        selector: '[data-tour="tuning-vtol-toggle"]',
        predicate: present('[data-tour="tuning-vtol-toggle"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.twoControllersOneAutopilot')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.aQuadplaneRunsSeparateControllersFor')} <strong>VTOL</strong> {tr('feature_tours.registry.rateController')}
              {' '}(<code className="font-mono text-[11px]">Q_A_RAT_</code>{tr('feature_tours.registry.andThe')}
              {' '}<strong>fixed-wing</strong> {tr('feature_tours.registry.controller')}
              {' '}(<code className="font-mono text-[11px]">RLL_RATE_</code> /
              {' '}<code className="font-mono text-[11px]">RLL2SRV_</code>).
            </p>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.theSlidersPresetsAndProfilesAll')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'flight-info-alpha32-5',
    view: 'mission',
    version: '0.0.32.5',
    get title() { return tr('feature_tours.registry.newTheFlightInfoBriefing'); },
    get blurb() { return tr('feature_tours.registry.aLivePreFlightBriefingFor'); },
    steps: [
      {
        selector: '[data-tour="flight-info-panel"]',
        // No predicate: the panel's tab is activated when this tour starts (see
        // MissionPlanningView), and mutationObservables lets the highlight snap
        // to it once dockview mounts the panel content.
        mutationObservables: ['[data-tour="flight-info-panel"]'],
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.briefTheFlightBeforeYouFly')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.theNew')} <strong>{tr('feature_tours.registry.flightInfo')}</strong> {tr('feature_tours.registry.tabTurnsYourMissionIntoThe')} <strong>{tr('feature_tours.registry.flightTime')}</strong> {tr('feature_tours.registry.andHowMany')} <strong>{tr('feature_tours.registry.batteries')}</strong> {tr('feature_tours.registry.itNeedsTotal')} <strong>{tr('feature_tours.registry.distance')}</strong> {tr('feature_tours.registry.and')} <strong>{tr('feature_tours.registry.altitude')}</strong> {tr('feature_tours.registry.againstTheCeilingAndLive')} <strong>{tr('feature_tours.registry.siteWeather')}</strong>.
            </p>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.windShowsAsA')} <strong>{tr('feature_tours.registry.compass')}</strong>{tr('feature_tours.registry.andThe2')} <strong>{tr('feature_tours.registry.daylight')}</strong> {tr('feature_tours.registry.barMarksWhenTheFlightWould')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'quick-launch-033',
    view: 'telemetry',
    version: '0.33',
    get title() { return tr('feature_tours.registry.quickLaunchTheAreaEditor'); },
    get blurb() { return tr('feature_tours.registry.popToolsIntoTheirOwnWindows'); },
    steps: [
      {
        selector: '[data-tour="welcome-cards"]',
        // Only shown on the disconnected welcome screen; skipped once connected.
        predicate: present('[data-tour="welcome-cards"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.jumpStraightIntoATool')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.noVehicleConnectedTheseCardsOpen')}
              {' '}<strong>{tr('feature_tours.registry.missionPlanning')}</strong>{tr('feature_tours.registry.the')} <strong>{tr('feature_tours.registry.areaEditor')}</strong>,
              {' '}<strong>SITL</strong>{tr('feature_tours.registry.the')} <strong>{tr('feature_tours.registry.n3dSimWorld')}</strong>{tr('feature_tours.registry.the')} <strong>{tr('feature_tours.registry.radioHud')}</strong>,
              {' '}<strong>{tr('feature_tours.registry.flightLogAnalysis')}</strong>, <strong>{tr('feature_tours.registry.firmwareFlash')}</strong> {tr('feature_tours.registry.andYour')}
              {' '}<strong>{tr('feature_tours.registry.missionLibrary')}</strong>.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="quick-launch"]',
        predicate: present('[data-tour="quick-launch"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.quickLaunchToolsInTheirOwn')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.openThe')} <strong>{tr('feature_tours.registry.mavlinkInspector')}</strong>{tr('feature_tours.registry.the')} <strong>{tr('feature_tours.registry.telemetryDashboard')}</strong> {tr('feature_tours.registry.orThe')}
              {' '}<strong>{tr('feature_tours.registry.n3dSimWorld')}</strong> {tr('feature_tours.registry.inASeparateWindowIdealFor')} <strong>{tr('feature_tours.registry.secondMonitor')}</strong>
              {' '}{tr('feature_tours.registry.whileYouKeepPlanningOrTuning')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="quick-launch"]',
        predicate: present('[data-tour="quick-launch"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.meetTheAreaEditor')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.theNew')} <strong>{tr('feature_tours.registry.areaEditor')}</strong> {tr('feature_tours.registry.opensFromHereAFullWindow')} <strong>{tr('feature_tours.registry.areasAndCorridors')}</strong> {tr('feature_tours.registry.multiPolygonHolesKmlImportA')}
              {' '}<strong>{tr('feature_tours.registry.flightBriefing')}</strong> {tr('feature_tours.registry.toggleHectaresAcresAndA')}
              {' '}<strong>go-to</strong> {tr('feature_tours.registry.searchToFlyToAnySite')} <strong>{tr('feature_tours.registry.sendToMission')}</strong>
              {' '}{tr('feature_tours.registry.dropsItStraightIntoThePlanner')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'rtk-ntrip-034',
    view: 'telemetry',
    version: '0.1.0',
    get title() { return tr('feature_tours.registry.rtkCorrectionsOverNtrip'); },
    get blurb() { return tr('feature_tours.registry.streamCentimeterGradeRtkCorrectionsFrom'); },
    cleanup: () => useWorkspaceDialogStore.getState().setOpen(false),
    steps: [
      {
        selector: '[data-tour="telemetry-layout-select"]',
        predicate: present('[data-tour="telemetry-layout-select"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.panelsLiveInTheWorkspace')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.the2')} <strong>{tr('feature_tours.registry.workspace')}</strong> {tr('feature_tours.registry.buttonHoldsTheLayoutsAndEvery')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="add-panel-rtk"]',
        setup: () => useWorkspaceDialogStore.getState().setOpen(true),
        mutationObservables: ['[data-tour="workspace-dialog"]'],
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.rtkNtripPanel')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.addThe')} <strong>RTK / NTRIP</strong> {tr('feature_tours.registry.panelPointItAtAnNtrip')} <strong>{tr('feature_tours.registry.rtcmCorrections')}</strong> {tr('feature_tours.registry.overMavlinkWithAnRtkCapable')} <strong>{tr('feature_tours.registry.rtkFixed')}</strong> {tr('feature_tours.registry.n12CmWithSeveralVehicles')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="map-instruments"]',
        setup: () => useWorkspaceDialogStore.getState().setOpen(false),
        mutationObservables: ['[data-tour="workspace-dialog"]'],
        predicate: present('[data-tour="map-instruments"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.rtkOnTheMap')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.under')} <strong>{tr('feature_tours.registry.instruments')}</strong> {tr('feature_tours.registry.thereIsAlsoAn')} <strong>RTK</strong> {tr('feature_tours.registry.instrumentThatShowsTheFixType')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'multi-vehicle-beta1',
    view: 'telemetry',
    version: '0.1.0',
    get title() { return tr('feature_tours.registry.newFlyAWholeFleet'); },
    get blurb() { return tr('feature_tours.registry.multiVehicleIsHereOneSwitch'); },
    steps: [
      {
        selector: '[data-tour="connection-multi-tab"]',
        predicate: present('[data-tour="connection-multi-tab"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.multiVehicleMode')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.switchTheConnectionSidebarTo')} <strong>{tr('feature_tours.registry.multiVehicle')}</strong> {tr('feature_tours.registry.andFlipItOnArdudeckStarts')} <strong>{tr('feature_tours.registry.addAVehicle')}</strong> {tr('feature_tours.registry.coversRadioInternetCellularAndSecond')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'log-explorer-beta1',
    view: 'logs',
    version: '0.1.0',
    get title() { return tr('feature_tours.registry.logExplorerRebuilt'); },
    get blurb() { return tr('feature_tours.registry.multipleChartsWithIndependentYAxes'); },
    steps: [
      {
        selector: '[data-tour="log-field-picker"]',
        predicate: present('[data-tour="log-field-picker"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.pickAnyRecordedField')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.searchEveryMessageTheLogContains')}
              {' '}<strong>{tr('feature_tours.registry.activeChart')}</strong> {tr('feature_tours.registry.addMoreChartsAndThePicker')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="log-chart-actions"]',
        predicate: present('[data-tour="log-chart-actions"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.independentAxesLiveStatsCsv')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.toggleBetweenASharedYAxis')} <strong>{tr('feature_tours.registry.oneAxisPerField')}</strong> {tr('feature_tours.registry.soRpmAndAttitudeCanShare')} <strong>{tr('feature_tours.registry.minAvgMax')}</strong> {tr('feature_tours.registry.recomputeOverTheVisibleWindowAs')} <strong>FFT</strong> {tr('feature_tours.registry.liveInThePanelsMenu')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'osd-tool-beta1',
    view: 'osd',
    version: '0.1.0',
    get title() { return tr('feature_tours.registry.osdToolKnowWhereYourOverlay'); },
    get blurb() { return tr('feature_tours.registry.composeAFullyCustomGroundHud'); },
    steps: [
      {
        selector: '[data-tour="osd-destination-bar"]',
        predicate: present('[data-tour="osd-destination-bar"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.threeOsdsThreeDestinations')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.thisBarIsTheGroundTruth')} <strong>{tr('feature_tours.registry.customHud')}</strong> {tr('feature_tours.registry.isDrawnByArdudeckOverYour')} <strong>{tr('feature_tours.registry.neverUploaded')}</strong> {tr('feature_tours.registry.toTheFlightControllerThe')} <strong>{tr('feature_tours.registry.textOsd')}</strong> {tr('feature_tours.registry.editorReadsAndWritesTheFc')} <strong>RubyFPV</strong> {tr('feature_tours.registry.designerExportsALayoutForRubyfpv')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'unit-preferences-beta1',
    view: 'settings',
    version: '0.1.0',
    get title() { return tr('feature_tours.registry.planInYourOwnUnits'); },
    get blurb() { return tr('feature_tours.registry.feetMphKnotsAcresPickPer'); },
    steps: [
      {
        selector: '[data-tour="unit-preferences"]',
        predicate: present('[data-tour="unit-preferences"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.displayUnits')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.setDistanceAltitudeSpeedAreaWeight')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'altitude-planning-beta1',
    view: 'mission',
    version: '0.1.0',
    get title() { return tr('feature_tours.registry.altitudeProfileThatUnderstandsFrames'); },
    get blurb() { return tr('feature_tours.registry.theProfileNowPlotsRelativeTerrain'); },
    steps: [
      {
        selector: '[data-tour="mission-altitude-panel"]',
        predicate: present('[data-tour="mission-altitude-panel"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.altitudeInTheFrameYouPlanned')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.waypointsPlotAgainstTerrainInTheir')} <strong>{tr('feature_tours.registry.n80m80mAgl')}</strong>{tr('feature_tours.registry.notAFalseCollisionTheAxis')} <strong>{tr('feature_tours.registry.heightAboveHome')}</strong> {tr('feature_tours.registry.withAslAlongsideTerrainFollowingSegments')} <strong>{tr('feature_tours.registry.scrollToZoomDragToPan')}</strong>{tr('feature_tours.registry.dragAWaypointDotToChange')} <strong>{tr('feature_tours.registry.autoAdjust')}</strong> {tr('feature_tours.registry.fixRealTerrainConflicts')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'radio-hud-beta1',
    view: 'radio-hud',
    version: '0.1.0',
    get title() { return tr('feature_tours.registry.yourRadioBecomesAMiniGcs'); },
    get blurb() { return tr('feature_tours.registry.designAnArdudeckTelemetryScreenFor'); },
    steps: [
      {
        selector: '[data-tour="hud-model"]',
        predicate: present('[data-tour="hud-model"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.pickYourRadio')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.colorRadiosTx15Tx16sNv14Get')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="hud-edit"]',
        predicate: present('[data-tour="hud-edit"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.makeTheScreenYours')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.onColorRadiosDragResizeAnd')} <strong>{tr('feature_tours.registry.n17InstrumentTiles')}</strong> {tr('feature_tours.registry.acrossUpTo8SwipeablePages')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="hud-config"]',
        predicate: present('[data-tour="hud-config"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.zeroConfigByDefault')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.everythingHereIsAn')} <strong>{tr('feature_tours.registry.override')}</strong>{tr('feature_tours.registry.leftOnAutoTheWidgetConfigures')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="hud-maps"]',
        predicate: present('[data-tour="hud-maps"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.offlineMapsOnTheRadio')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.clickYourFlyingFieldAndArdudeck')} <strong>{tr('feature_tours.registry.satelliteImagesAtThreeZoomLevels')}</strong> {tr('feature_tours.registry.forTheMapTileVehicleHome')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="hud-apply"]',
        predicate: present('[data-tour="hud-apply"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.oneClickToTheRadio')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.plugTheRadioInViaUsb')} <strong>{tr('feature_tours.registry.usbStorage')}</strong> {tr('feature_tours.registry.onItsScreenAndHit')} <strong>{tr('feature_tours.registry.apply')}</strong> {tr('feature_tours.registry.widgetConfigVoicePackAndMaps')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'map-instruments-beta1',
    view: 'telemetry',
    version: '0.1.2',
    get title() { return tr('feature_tours.registry.instrumentsOnTheMap'); },
    get blurb() { return tr('feature_tours.registry.gaugesAttitudeMessagesAndRtkFloat'); },
    steps: [
      {
        selector: '[data-tour="map-instruments"]',
        predicate: present('[data-tour="map-instruments"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.pickWhatFloatsOnTheMap')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              <strong>{tr('feature_tours.registry.instruments')}</strong> {tr('feature_tours.registry.turnsSpeedAltitudeAttitudeHeadingBattery')}
              {' '}<strong>{tr('feature_tours.registry.messages')}</strong> {tr('feature_tours.registry.and')} <strong>RTK</strong> {tr('feature_tours.registry.onAndOffOrLoadsA')} <strong>{tr('feature_tours.registry.group')}</strong> {tr('feature_tours.registry.themIntoASingleTrayDrag')}
            </p>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.aSaved')} <strong>{tr('feature_tours.registry.workspace')}</strong> {tr('feature_tours.registry.layoutRemembersTheInstrumentsAlongWith')}
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="vision-stream"]',
        // Only in synthetic Vision mode, where the Stream button exists.
        predicate: present('[data-tour="vision-stream"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.streamTheSyntheticView')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              <strong>{tr('feature_tours.registry.stream')}</strong> {tr('feature_tours.registry.publishesTheVisionViewWithOr')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'vehicle-setup-beta1',
    view: 'parameters',
    version: '0.1.2',
    get title() { return tr('feature_tours.registry.vehicleSetupWithoutTheParameterTable'); },
    get blurb() { return tr('feature_tours.registry.everyTabHereIsAPage'); },
    cleanup: () => useConfigTabMenuStore.getState().setOpenGroupId(null),
    steps: [
      {
        selector: '[data-tour="mavlink-tabs"]',
        predicate: present('[data-tour="mavlink-tabs"]'),
        setup: () => useConfigTabMenuStore.getState().setOpenGroupId(null),
        content: (
          <TourText title={tr('feature_tours.registry.pagesNotParameterNames')}>
            {tr('feature_tours.registry.eachTabSetsUpOneJob')}
          </TourText>
        ),
      },
      groupStep('tuning-group', 'Tuning', (
        <>
          <strong>PID</strong> {tr('feature_tours.registry.gainsPerAxis')} <strong>{tr('feature_tours.registry.rates')}</strong> {tr('feature_tours.registry.andExpo')} <strong>{tr('feature_tours.registry.tuning')}</strong> {tr('feature_tours.registry.presetsAnd')} <strong>AutoTune</strong> {tr('feature_tours.registry.setUpWithoutHuntingForIts')}
        </>
      )),
      groupStep('rover-tuning-group', 'Tuning', (
        <>
          {tr('feature_tours.registry.steeringAndSpeedControllerGains')} <strong>{tr('feature_tours.registry.speedSteering')}</strong> {tr('feature_tours.registry.limitsAnd')}
          {' '}<strong>{tr('feature_tours.registry.navigation')}</strong> {tr('feature_tours.registry.forWaypointFollowingAndLoiter')}
        </>
      )),
      groupStep('rc-group', 'RC', (
        <>
          <strong>{tr('feature_tours.registry.receiver')}</strong> {tr('feature_tours.registry.showsTheProtocolAndEveryChannel')} <strong>{tr('feature_tours.registry.modes')}</strong> {tr('feature_tours.registry.mapsTheSwitchPositionsToModes')}
        </>
      )),
      groupStep('outputs-group', 'Outputs', (
        <>
          <strong>{tr('feature_tours.registry.motorTest')}</strong> {tr('feature_tours.registry.spinsOneMotorAtATime')} <strong>{tr('feature_tours.registry.servoOutput')}</strong> {tr('feature_tours.registry.setsEachChannelSFunctionReverse')}
        </>
      )),
      itemStep('servo-output', tr('feature_tours.registry.servoOutput'), (
        <>{tr('feature_tours.registry.eachOutputSFunctionReverseMin')}</>
      )),
      groupStep('safety-group', 'Safety', (
        <>
          <strong>{tr('feature_tours.registry.arming')}</strong> {tr('feature_tours.registry.listsThePreArmChecksAnd')} <strong>{tr('feature_tours.registry.failsafesFence')}</strong>
          {' '}{tr('feature_tours.registry.setsWhatHappensOnLinkLoss')}
        </>
      )),
      itemStep('battery', 'Battery', (
        <>{tr('feature_tours.registry.monitorTypeVoltageAndCurrentSensing')}</>
      )),
      groupStep('hardware-group', 'Sensors', (
        <>
          <strong>{tr('feature_tours.registry.health')}</strong> {tr('feature_tours.registry.forEverySensorLive')} <strong>{tr('feature_tours.registry.configuration')}</strong> {tr('feature_tours.registry.forBoardOrientationCompassesAndGps')} <strong>{tr('feature_tours.registry.ledsSound')}</strong> {tr('feature_tours.registry.forTheLedBuzzerAndSafety')}
        </>
      )),
      groupStep('links-group', 'Links', (
        <>
          <strong>{tr('feature_tours.registry.serialPorts')}</strong> {tr('feature_tours.registry.setsWhatRunsOnEachPort')} <strong>{tr('feature_tours.registry.telemetryRates')}</strong> {tr('feature_tours.registry.worksOutWhichMavlinkChannelA')}
        </>
      )),
      groupStep('storage-group', 'Storage', (
        <>
          <strong>{tr('feature_tours.registry.logging')}</strong> {tr('feature_tours.registry.choosesWhatTheCardRecords')} <strong>{tr('feature_tours.registry.files')}</strong> {tr('feature_tours.registry.browsesTheFlightControllerOverMavlink')} <strong>{tr('feature_tours.registry.parameters')}</strong> {tr('feature_tours.registry.isTheFullTableForWhat')}
        </>
      )),
    ],
  },
  {
    id: 'calibration-beta1',
    view: 'calibration',
    version: '0.1.2',
    get title() { return tr('feature_tours.registry.sensorCalibration'); },
    get blurb() { return tr('feature_tours.registry.accelerometerCompassLevelAndTheRest'); },
    steps: [
      {
        selector: '[data-tour="calibration-types"]',
        predicate: present('[data-tour="calibration-types"]'),
        mutationObservables: ['[data-tour="calibration-types"]'],
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.pickWhatToCalibrate')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.eachCardIsAGuidedCalibration')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'library-projects-beta1',
    view: 'library',
    version: '0.1.2',
    get title() { return tr('feature_tours.registry.projects'); },
    get blurb() { return tr('feature_tours.registry.oneSiteAllOfItsSurvey'); },
    steps: [
      {
        selector: '[data-tour="library-tabs"]',
        predicate: present('[data-tour="library-tabs"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">{tr('feature_tours.registry.missionsAreasAndProjects')}</div>
            <p className="text-xs leading-relaxed opacity-90">
              {tr('feature_tours.registry.giveAMissionOrASurvey')} <strong>{tr('feature_tours.registry.project')}</strong> {tr('feature_tours.registry.nameWhenYouSaveItAnd')} <strong>{tr('feature_tours.registry.projects')}</strong> {tr('feature_tours.registry.withEverythingElseForThatSite')}
            </p>
          </div>
        ),
      },
    ],
  },
];

export function getToursForView(view: string): FeatureTour[] {
  return FEATURE_TOURS.filter((t) => t.view === view);
}

export function getTourById(id: string): FeatureTour | undefined {
  return FEATURE_TOURS.find((t) => t.id === id);
}
