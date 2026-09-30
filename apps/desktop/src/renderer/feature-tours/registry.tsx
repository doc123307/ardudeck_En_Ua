import type { FeatureTour, FeatureTourStep } from './types';
import { useConfigTabMenuStore } from '../stores/config-tab-menu-store';
import { useWorkspaceDialogStore } from '../stores/workspace-dialog-store';
import { useSurveyMenuStore } from '../stores/survey-menu-store';
import { useParameterStore } from '../stores/parameter-store';
import { hasDualVtolControllers } from '../components/mavlink-config/mavlink-pid-schemes';

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
    title: 'Mission planning, leveled up',
    blurb:
      'Grouped missions, corridor surveys, GSD-first planning, GIS import, multi-format export, and full undo - all in the planner.',
    cleanup: () => useSurveyMenuStore.getState().setOpen(false),
    steps: [
      {
        selector: '[data-tour="mission-group"]',
        predicate: present('[data-tour="mission-group"]'),
        setup: () => useSurveyMenuStore.getState().setOpen(false),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Missions are organized into groups</div>
            <p className="text-xs leading-relaxed opacity-90">
              Every waypoint now lives in a named, colored <strong>group</strong>. Click the swatch
              to recolor, the checkbox to show/hide it on the map, and the per-group button to
              upload or save just that group. Each header shows the group's
              {' '}<strong>distance, flight time and GSD</strong> at a glance.
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
            <div className="text-sm font-semibold">Corridor surveys</div>
            <p className="text-xs leading-relaxed opacity-90">
              Under the <strong>Survey</strong> button, pick <strong>Corridor</strong> for linear
              jobs - roads, rail, power lines, pipelines. Draw a centerline and ArduDeck lays
              parallel strips along it. Pick <strong>Plane</strong> (racetrack turns at sharp bends)
              or <strong>Copter</strong> (turns on the spot), and set width, strip count and overlap.
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
            <div className="text-sm font-semibold">Smarter area surveys</div>
            <p className="text-xs leading-relaxed opacity-90">
              Plan by <strong>GSD</strong> (cm/px) instead of guessing altitude, see live
              {' '}<strong>battery and data</strong> estimates, and split a big job into
              {' '}<strong>battery-sized sorties</strong> in one click. Crosshatch can even fly its
              two passes at <strong>two different heights</strong> for better 3D.
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
            <div className="text-sm font-semibold">Import an area from GIS</div>
            <p className="text-xs leading-relaxed opacity-90">
              Bring a survey boundary straight in from <strong>KML</strong>, <strong>KMZ</strong> or
              {' '}<strong>GeoJSON</strong> - one survey group per polygon, inner rings kept as
              no-fly holes. No more re-tracing a boundary by hand.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="mission-export"]',
        predicate: present('[data-tour="mission-export"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Export in any format</div>
            <p className="text-xs leading-relaxed opacity-90">
              Save or export the whole mission from here - <strong>.waypoints</strong> (QGC WPL, for
              ArduPilot / Mission Planner) or <strong>.plan</strong> (QGroundControl). Pick the
              format up front; no guessing from the file dialog.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="mission-history"]',
        predicate: present('[data-tour="mission-history"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Undo, redo and crash recovery</div>
            <p className="text-xs leading-relaxed opacity-90">
              Full <strong>undo / redo</strong> (Cmd/Ctrl+Z) across edits, plus automatic
              {' '}<strong>autosave</strong> - if the app closes mid-plan, your mission is recovered
              on the next launch.
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
    title: 'Tune VTOL and fixed-wing separately',
    blurb: 'QuadPlanes carry two controller sets. The PID tab now lets you switch which one you tune.',
    // Only offer this on a QuadPlane that exposes both control-law sets; on any
    // other vehicle the switch does not exist, so the tour stays hidden.
    predicate: () => hasDualVtolControllers(useParameterStore.getState().parameters),
    steps: [
      {
        selector: '[data-tour="tuning-vtol-toggle"]',
        predicate: present('[data-tour="tuning-vtol-toggle"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Two controllers, one autopilot</div>
            <p className="text-xs leading-relaxed opacity-90">
              A QuadPlane runs separate controllers for hover and forward flight. This switch flips
              the PID tab between the <strong>VTOL</strong> rate controller
              {' '}(<code className="font-mono text-[11px]">Q_A_RAT_</code>) and the
              {' '}<strong>fixed-wing</strong> controller
              {' '}(<code className="font-mono text-[11px]">RLL_RATE_</code> /
              {' '}<code className="font-mono text-[11px]">RLL2SRV_</code>).
            </p>
            <p className="text-xs leading-relaxed opacity-90">
              The sliders, presets and profiles all follow your choice, so you can tune each set
              without leaving the page.
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
    title: 'New: the Flight Info briefing',
    blurb:
      'A live pre-flight briefing for any mission or survey: endurance and batteries, distance and altitude, site wind and weather, and your daylight window.',
    steps: [
      {
        selector: '[data-tour="flight-info-panel"]',
        // No predicate: the panel's tab is activated when this tour starts (see
        // MissionPlanningView), and mutationObservables lets the highlight snap
        // to it once dockview mounts the panel content.
        mutationObservables: ['[data-tour="flight-info-panel"]'],
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Brief the flight before you fly it</div>
            <p className="text-xs leading-relaxed opacity-90">
              The new <strong>Flight Info</strong> tab turns your mission into the numbers a pilot
              decides on: <strong>flight time</strong> and how many <strong>batteries</strong> it
              needs, total <strong>distance</strong> and <strong>altitude</strong> against the
              ceiling, and live <strong>site weather</strong>.
            </p>
            <p className="text-xs leading-relaxed opacity-90">
              Wind shows as a <strong>compass</strong>, and the <strong>daylight</strong> bar marks
              when the flight would finish against sunset - so you can see at a glance whether it
              lands before dark.
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
    title: 'Quick Launch & the Area Editor',
    blurb:
      'Pop tools into their own windows from the header, and jump straight into the new Area Editor for drawing survey areas and corridors.',
    steps: [
      {
        selector: '[data-tour="welcome-cards"]',
        // Only shown on the disconnected welcome screen; skipped once connected.
        predicate: present('[data-tour="welcome-cards"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Jump straight into a tool</div>
            <p className="text-xs leading-relaxed opacity-90">
              No vehicle connected? These cards open the tools that work offline:
              {' '}<strong>Mission Planning</strong>, the <strong>Area Editor</strong>,
              {' '}<strong>SITL</strong>, the <strong>3D Sim World</strong>, the <strong>Radio HUD</strong>,
              {' '}<strong>Flight Log Analysis</strong>, <strong>Firmware Flash</strong> and your
              {' '}<strong>Mission Library</strong>.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="quick-launch"]',
        predicate: present('[data-tour="quick-launch"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Quick Launch - tools in their own window</div>
            <p className="text-xs leading-relaxed opacity-90">
              Open the <strong>MAVLink Inspector</strong>, the <strong>Telemetry Dashboard</strong> or the
              {' '}<strong>3D Sim World</strong> in a separate window, ideal for a <strong>second monitor</strong>
              {' '}while you keep planning or tuning in the main window. Each stays live alongside the rest of the app.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="quick-launch"]',
        predicate: present('[data-tour="quick-launch"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Meet the Area Editor</div>
            <p className="text-xs leading-relaxed opacity-90">
              The new <strong>Area Editor</strong> opens from here: a full-window map for drawing
              survey <strong>areas and corridors</strong> - multi-polygon, holes, KML import, a live
              {' '}<strong>flight briefing</strong> (toggle hectares/acres), and a
              {' '}<strong>go-to</strong> search to fly to any site. <strong>Send to mission</strong>
              {' '}drops it straight into the planner.
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
    title: 'RTK corrections over NTRIP',
    blurb:
      'Stream centimeter-grade RTK corrections from any NTRIP caster straight to your vehicle, and watch the fix on the map.',
    cleanup: () => useWorkspaceDialogStore.getState().setOpen(false),
    steps: [
      {
        selector: '[data-tour="telemetry-layout-select"]',
        predicate: present('[data-tour="telemetry-layout-select"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Panels live in the Workspace</div>
            <p className="text-xs leading-relaxed opacity-90">
              The <strong>Workspace</strong> button holds the layouts and every panel you can add.
              The RTK panel is one of them.
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
            <div className="text-sm font-semibold">RTK / NTRIP panel</div>
            <p className="text-xs leading-relaxed opacity-90">
              Add the <strong>RTK / NTRIP</strong> panel, point it at an NTRIP caster and pick a
              mountpoint. ArduDeck forwards the <strong>RTCM corrections</strong> over MAVLink; with an
              RTK-capable GPS the fix climbs to <strong>RTK Fixed</strong> (1-2 cm). With several
              vehicles connected, every one of them gets the corrections.
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
            <div className="text-sm font-semibold">RTK on the map</div>
            <p className="text-xs leading-relaxed opacity-90">
              Under <strong>Instruments</strong> there is also an <strong>RTK</strong> instrument that
              shows the fix type and correction age right on the map, where you are looking anyway.
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
    title: 'New: fly a whole fleet',
    blurb:
      'Multi-vehicle is here: one switch starts the engine, vehicles appear as they come online, and ArduDeck commands them individually or together.',
    steps: [
      {
        selector: '[data-tour="connection-multi-tab"]',
        predicate: present('[data-tour="connection-multi-tab"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Multi-vehicle mode</div>
            <p className="text-xs leading-relaxed opacity-90">
              Switch the connection sidebar to <strong>Multi-vehicle</strong> and flip it on:
              ArduDeck starts its engine in the background and vehicles appear as their
              heartbeats arrive - no ports, no URLs. <strong>Add a vehicle</strong> covers radio,
              internet, cellular and second-ground-station links. Click a vehicle in the fleet
              list and the telemetry, map and commands switch to it.
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
    title: 'Log Explorer, rebuilt',
    blurb:
      'Multiple charts with independent y-axes, window-aware stats, events and FFT panels, and a flight path map that follows your cursor.',
    steps: [
      {
        selector: '[data-tour="log-field-picker"]',
        predicate: present('[data-tour="log-field-picker"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Pick any recorded field</div>
            <p className="text-xs leading-relaxed opacity-90">
              Search every message the log contains and toggle fields onto the
              {' '}<strong>active chart</strong> - add more charts and the picker targets whichever
              one you focus. Multi-instance messages (two GPS units, four ESCs) expand per
              instance, and units come straight from the log.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="log-chart-actions"]',
        predicate: present('[data-tour="log-chart-actions"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Independent axes, live stats, CSV</div>
            <p className="text-xs leading-relaxed opacity-90">
              Toggle between a shared y-axis and <strong>one axis per field</strong> so RPM and
              attitude can share a chart. The legend's <strong>min / avg / max</strong> recompute
              over the visible window as you zoom and pan, and the export button saves exactly
              that window as CSV. Events, Params and <strong>FFT</strong> live in the panels menu.
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
    title: 'OSD Tool: know where your overlay lives',
    blurb:
      'Compose a fully custom ground HUD, edit the FC Text OSD, or author a RubyFPV layout - the destination bar always shows where each one ends up.',
    steps: [
      {
        selector: '[data-tour="osd-destination-bar"]',
        predicate: present('[data-tour="osd-destination-bar"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Three OSDs, three destinations</div>
            <p className="text-xs leading-relaxed opacity-90">
              This bar is the ground truth: the <strong>custom HUD</strong> is drawn by ArduDeck
              over your screen and video feed and is <strong>never uploaded</strong> to the flight
              controller; the <strong>Text OSD</strong> editor reads and writes the FC's real
              OSDn_* layout; the <strong>RubyFPV</strong> designer exports a layout for RubyFPV
              ground stations. All three preview over your live video feed.
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
    title: 'Plan in your own units',
    blurb: 'Feet, mph, knots, acres - pick per-quantity display units and the whole app follows.',
    steps: [
      {
        selector: '[data-tour="unit-preferences"]',
        predicate: present('[data-tour="unit-preferences"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Display Units</div>
            <p className="text-xs leading-relaxed opacity-90">
              Set distance, altitude, speed, area, weight and more independently - mission
              planning, telemetry panels, the log explorer and survey estimates all render in
              your choice. Values sent to the vehicle stay metric under the hood, so nothing
              about the flight changes.
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
    title: 'Altitude profile that understands frames',
    blurb:
      'The profile now plots relative, terrain and ASL waypoints correctly against real terrain - with AGL labels, collision warnings you can trust, and zoom.',
    steps: [
      {
        selector: '[data-tour="mission-altitude-panel"]',
        predicate: present('[data-tour="mission-altitude-panel"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Altitude, in the frame you planned it</div>
            <p className="text-xs leading-relaxed opacity-90">
              Waypoints plot against terrain in their own altitude frame, so an 80m-relative
              survey at a mountain site reads <strong>80m (80m AGL)</strong>, not a false
              collision. The axis shows <strong>height above home</strong> with ASL alongside,
              terrain-following segments hug the ground, and the dashed line is your safety
              clearance. <strong>Scroll to zoom, drag to pan</strong>, drag a waypoint dot to
              change its altitude, and let <strong>Auto Adjust</strong> fix real terrain
              conflicts.
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
    title: 'Your radio becomes a mini GCS',
    blurb:
      'Design an ArduDeck telemetry screen for your EdgeTX radio - live preview, drag-and-drop layout, offline field maps, voice alerts - and push it to the SD card in one click.',
    steps: [
      {
        selector: '[data-tour="hud-model"]',
        predicate: present('[data-tour="hud-model"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Pick your radio</div>
            <p className="text-xs leading-relaxed opacity-90">
              Color radios (TX15, TX16S, NV14...) get the full widget - the preview is a faithful
              mirror of that screen. Monochrome radios (Boxer, Zorro, TX12, X9D) get a dense
              1-bit telemetry script with the same voice alerts. Layouts rescale when you switch.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="hud-edit"]',
        predicate: present('[data-tour="hud-edit"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Make the screen yours</div>
            <p className="text-xs leading-relaxed opacity-90">
              On color radios: drag, resize and swap <strong>17 instrument tiles</strong> across
              up to 8 swipeable pages (or start from a preset). On monochrome: every data slot,
              the big readout and the center panel (horizon or data wall) are assignable in place.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="hud-config"]',
        predicate: present('[data-tour="hud-config"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Zero-config by default</div>
            <p className="text-xs leading-relaxed opacity-90">
              Everything here is an <strong>override</strong>. Left on auto, the widget configures
              itself from the vehicle's own telemetry over ELRS - cell count, capacity, battery %
              - no ArduDeck connection needed in the field.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="hud-maps"]',
        predicate: present('[data-tour="hud-maps"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Offline maps on the radio</div>
            <p className="text-xs leading-relaxed opacity-90">
              Click your flying field and ArduDeck stitches <strong>satellite images at three
              zoom levels</strong> for the Map tile - vehicle, home, trail and your planned
              mission drawn on top, fully offline. Tap the tile on the radio to switch zoom.
            </p>
          </div>
        ),
      },
      {
        selector: '[data-tour="hud-apply"]',
        predicate: present('[data-tour="hud-apply"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">One click to the radio</div>
            <p className="text-xs leading-relaxed opacity-90">
              Plug the radio in via USB (choose <strong>USB Storage</strong> on its screen) and
              hit <strong>Apply</strong> - widget, config, voice pack and maps land on the SD
              card together. Then on the radio: App layout, full-screen widget, ArduDeck.
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
    title: 'Instruments on the map',
    blurb: 'Gauges, attitude, messages and RTK float over the map. Drag them, group them and save the arrangement with a layout.',
    steps: [
      {
        selector: '[data-tour="map-instruments"]',
        predicate: present('[data-tour="map-instruments"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Pick what floats on the map</div>
            <p className="text-xs leading-relaxed opacity-90">
              <strong>Instruments</strong> turns speed, altitude, attitude, heading, battery,
              {' '}<strong>Messages</strong> and <strong>RTK</strong> on and off, or loads a whole cockpit preset.
              Drag one onto another to <strong>group</strong> them into a single tray; drag it out to split it.
            </p>
            <p className="text-xs leading-relaxed opacity-90">
              A saved <strong>Workspace</strong> layout remembers the instruments along with the panels.
              Settings, Guides replays the animated walkthrough.
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
            <div className="text-sm font-semibold">Stream the synthetic view</div>
            <p className="text-xs leading-relaxed opacity-90">
              <strong>Stream</strong> publishes the Vision view, with or without the HUD, as RTSP, WebRTC and
              SRT. Open it in VLC, ffmpeg, OpenCV or a browser.
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
    title: 'Vehicle setup without the parameter table',
    blurb: 'Every tab here is a page over the parameters one job needs, in plain words. The raw table is the last resort.',
    cleanup: () => useConfigTabMenuStore.getState().setOpenGroupId(null),
    steps: [
      {
        selector: '[data-tour="mavlink-tabs"]',
        predicate: present('[data-tour="mavlink-tabs"]'),
        setup: () => useConfigTabMenuStore.getState().setOpenGroupId(null),
        content: (
          <TourText title="Pages, not parameter names">
            Each tab sets up one job and writes the right parameters for this firmware, with live data beside
            the settings so you see the effect. Most tabs sit in a group: the next steps open each one.
          </TourText>
        ),
      },
      groupStep('tuning-group', 'Tuning', (
        <>
          <strong>PID</strong> gains per axis, <strong>Rates</strong> and expo, <strong>Tuning</strong> presets,
          and <strong>AutoTune</strong> set up without hunting for its parameters. AutoTune refuses edits while armed.
        </>
      )),
      groupStep('rover-tuning-group', 'Tuning', (
        <>
          Steering and speed controller gains, <strong>Speed &amp; Steering</strong> limits, and
          {' '}<strong>Navigation</strong> for waypoint following and loiter.
        </>
      )),
      groupStep('rc-group', 'RC', (
        <>
          <strong>Receiver</strong> shows the protocol and every channel live. <strong>Modes</strong> maps
          the switch positions to modes and shows which slot the switch is in right now.
        </>
      )),
      groupStep('outputs-group', 'Outputs', (
        <>
          <strong>Motor Test</strong> spins one motor at a time with live vibration and ESC data (props off, it
          asks first). <strong>Servo Output</strong> sets each channel's function, reverse and range with a live bar.
        </>
      )),
      itemStep('servo-output', 'Servo Output', (
        <>Each output's function, reverse, min, trim and max, with the live position on every row.</>
      )),
      groupStep('safety-group', 'Safety', (
        <>
          <strong>Arming</strong> lists the pre-arm checks and what is failing now. <strong>Failsafes &amp; fence</strong>
          {' '}sets what happens on link loss, low battery and a fence breach. Pre-arm quick fixes open these pages.
        </>
      )),
      itemStep('battery', 'Battery', (
        <>Monitor type, voltage and current sensing, and the low, critical and arming voltages, suggested from cell count and chemistry.</>
      )),
      groupStep('hardware-group', 'Sensors', (
        <>
          <strong>Health</strong> for every sensor live, <strong>Configuration</strong> for board orientation,
          compasses and GPS wiring, and <strong>LEDs &amp; Sound</strong> for the LED, buzzer and safety button.
        </>
      )),
      groupStep('links-group', 'Links', (
        <>
          <strong>Serial Ports</strong> sets what runs on each port. <strong>Telemetry Rates</strong> works out
          which MAVLink channel a port is and shows what each rate costs on the link.
        </>
      )),
      groupStep('storage-group', 'Storage', (
        <>
          <strong>Logging</strong> chooses what the card records. <strong>Files</strong> browses the flight
          controller over MAVLink-FTP. <strong>Parameters</strong> is the full table, for what no page covers yet.
        </>
      )),
    ],
  },
  {
    id: 'calibration-beta1',
    view: 'calibration',
    version: '0.1.2',
    title: 'Sensor calibration',
    blurb: 'Accelerometer, compass, level and the rest, each as a guided step with live feedback.',
    steps: [
      {
        selector: '[data-tour="calibration-types"]',
        predicate: present('[data-tour="calibration-types"]'),
        mutationObservables: ['[data-tour="calibration-types"]'],
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Pick what to calibrate</div>
            <p className="text-xs leading-relaxed opacity-90">
              Each card is a guided calibration. Cards the vehicle has no sensor for stay greyed out. The
              compass calibration shows which directions are already covered while you turn the aircraft.
              A pre-arm fix that needs a calibration opens the right card directly.
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
    title: 'Projects',
    blurb: 'One site, all of its survey areas and missions, local and from the vault, in one place.',
    steps: [
      {
        selector: '[data-tour="library-tabs"]',
        predicate: present('[data-tour="library-tabs"]'),
        content: (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Missions, areas and projects</div>
            <p className="text-xs leading-relaxed opacity-90">
              Give a mission or a survey area a <strong>project</strong> name when you save it and it collects
              under <strong>Projects</strong> with everything else for that site, including what is in the vault.
              Open an area or a mission from there and it lands in the planner.
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
