import type { Locale } from '../progression/Settings';
import { en } from './en';
import { es, type StringKey } from './es';

export type { StringKey };

const DICTIONARIES: Record<Locale, Record<StringKey, string>> = { es, en };
let current: Locale = 'es';

export function setLocale(locale: Locale) {
  current = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

export function getLocale() {
  return current;
}

/** Looks up a UI string and fills `{name}` placeholders. Unknown placeholders stay visible. */
export function t(key: StringKey, params?: Record<string, string | number>) {
  const template = DICTIONARIES[current][key] ?? es[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
