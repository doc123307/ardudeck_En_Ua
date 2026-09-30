import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import uk from './locales/uk.json';
import ru from './locales/ru.json';

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
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!).sort();
}

const english = flatten(en as Tree);
const translations = { uk: flatten(uk as Tree), ru: flatten(ru as Tree) };

describe.each(Object.entries(translations))('%s translation', (_lang, strings) => {
  it('has exactly the English keys', () => {
    expect(Object.keys(strings).sort()).toEqual(Object.keys(english).sort());
  });

  it('keeps every {{placeholder}} of the English text', () => {
    for (const [key, text] of Object.entries(english)) {
      expect(placeholders(strings[key] ?? ''), key).toEqual(placeholders(text));
    }
  });

  it('has no empty strings', () => {
    for (const [key, text] of Object.entries(strings)) {
      expect(text.trim(), key).not.toBe('');
    }
  });
});
