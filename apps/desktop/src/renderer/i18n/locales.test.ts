import { describe, expect, it } from 'vitest';
import { loadLocaleTree } from './index';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!))].sort();
}

// English builds plurals by gluing a suffix onto a word ("param{{v2}}"); Ukrainian and
// Russian inflect differently, so a translation may drop exactly those placeholders.
function pluralSuffixes(text: string): string[] {
  return [...text.matchAll(/(?<=[a-z])\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!);
}

const english = flatten(loadLocaleTree('en'));
const translations = { uk: flatten(loadLocaleTree('uk')), ru: flatten(loadLocaleTree('ru')) };

describe.each(Object.entries(translations))('%s translation', (_lang, strings) => {
  it('has exactly the English keys', () => {
    const missing = Object.keys(english).filter((key) => !(key in strings));
    const extra = Object.keys(strings).filter((key) => !(key in english));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it('keeps every {{placeholder}} of the English text', () => {
    for (const [key, text] of Object.entries(english)) {
      if (!(key in strings)) continue;
      const optional = pluralSuffixes(text);
      const expected = placeholders(text).filter((p) => !optional.includes(p) || strings[key]!.includes(`{{${p}}}`));
      expect(placeholders(strings[key]!), key).toEqual(expected);
    }
  });

  it('has no empty strings', () => {
    for (const [key, text] of Object.entries(strings)) {
      expect(text.trim(), key).not.toBe('');
    }
  });
});
