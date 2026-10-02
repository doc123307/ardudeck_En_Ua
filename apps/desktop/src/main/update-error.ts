import { mt } from './i18n';

/**
 * What to show when an update check fails.
 *
 * A release without an update feed (latest.yml) is a draft or private release, or
 * a build that is handed out by hand. That is not a fault of the app, so say so in
 * one plain sentence instead of the HTTP dump electron-updater produces.
 */
export function updateErrorMessage(raw: string): string {
  if (/latest[\w-]*\.yml|\b404\b|ERR_UPDATER_(CHANNEL_FILE|LATEST_VERSION)_NOT_FOUND/i.test(raw)) {
    return mt('main.updater.noUpdateFeed');
  }
  // Keep the first line only: the rest is headers and a stack trace.
  return raw.split('\n')[0]!.slice(0, 300);
}
