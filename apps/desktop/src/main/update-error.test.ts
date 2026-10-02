import { describe, it, expect, afterEach } from 'vitest';
import { updateErrorMessage } from './update-error';
import { setMainLanguage } from './i18n';

// What electron-updater reports when the release has no latest.yml (a draft release).
const NO_FEED = 'Cannot find latest.yml in the latest release artifacts (https://github.com/o/r/releases/download/v1/latest.yml): '
  + 'HttpError: 404 "method: GET url: https://github.com/o/r/releases/download/v1/latest.yml\n\nPlease double check that your '
  + 'authentication token is correct."\nHeaders: { "cache-control": "no-cache" }\n    at createHttpError (httpExecutor.js:21:12)';

afterEach(() => setMainLanguage('en'));

describe('updateErrorMessage', () => {
  it('turns a missing update feed into one plain sentence', () => {
    const text = updateErrorMessage(NO_FEED);
    expect(text).toBe('No updates are published for this build. New versions are handed out separately.');
  });

  it('says it in the selected language', () => {
    setMainLanguage('uk');
    expect(updateErrorMessage(NO_FEED)).toBe('Для цієї збірки оновлення не публікуються. Нові версії надаються окремо.');
  });

  it('covers the Linux and macOS feed names', () => {
    expect(updateErrorMessage('Cannot find latest-linux.yml in the latest release artifacts')).not.toContain('latest-linux');
  });

  it('keeps only the first line of any other failure', () => {
    expect(updateErrorMessage('net::ERR_INTERNET_DISCONNECTED\n    at SimpleURLLoaderWrapper (node:electron)')).toBe('net::ERR_INTERNET_DISCONNECTED');
  });
});
