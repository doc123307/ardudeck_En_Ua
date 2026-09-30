import { t } from '../../i18n';
/**
 * Companion panel registry for dockview.
 * Panel component implementations are in Plan 3 — this defines the registry structure.
 */

// Panel registry for companion dockview instance
export const COMPANION_PANEL_COMPONENTS = {
  status: { component: 'CompanionStatusPanel', get title() { return t('companion.index.status'); } },
  metrics: { component: 'CompanionMetricsPanel', get title() { return t('companion.index.systemMetrics'); } },
  network: { component: 'CompanionNetworkPanel', get title() { return t('companion.index.network'); } },
  processes: { component: 'CompanionProcessesPanel', get title() { return t('companion.index.processes'); } },
  logs: { component: 'CompanionLogsPanel', get title() { return t('companion.index.logs'); } },
  terminal: { component: 'CompanionTerminalPanel', get title() { return t('companion.index.terminal'); } },
  fileBrowser: { component: 'CompanionFileBrowserPanel', get title() { return t('companion.index.fileBrowser'); } },
  services: { component: 'CompanionServicesPanel', get title() { return t('companion.index.services'); } },
  containers: { component: 'CompanionContainersPanel', get title() { return t('companion.index.containers'); } },
  extensions: { component: 'CompanionExtensionsPanel', get title() { return t('companion.index.extensions'); } },
  droneBridgeStatus: { component: 'CompanionDroneBridgeStatusPanel', title: 'DroneBridge' },
  droneBridgeSettings: { component: 'CompanionDroneBridgeSettingsPanel', get title() { return t('companion.index.dronebridgeSettings'); } },
} as const;

export type CompanionPanelId = keyof typeof COMPANION_PANEL_COMPONENTS;
