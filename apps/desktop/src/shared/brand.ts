/**
 * Product identity. The UI name is localized (locales core.json `brand.name`); this is the
 * Latin form for places that are not: window titles, file headers, exported metadata.
 *
 * Internal identifiers (settings folder, ardudeck:// links, script and widget folders on the
 * vehicle and radio) keep their original names so existing data and installs keep working.
 */
export const BRAND_NAME = 'STOHID';

/** This project. */
export const PROJECT_URL = 'https://github.com/doc123307/ardudeck_En_Ua';
export const PROJECT_REPO = { owner: 'doc123307', repo: 'ardudeck_En_Ua' } as const;

/** The open-source project this one is built on; credited on the About page. */
export const UPSTREAM_NAME = 'ArduDeck';
export const UPSTREAM_URL = 'https://github.com/rubenCodeforges/ardudeck';
