import type { Locale } from '../progression/Settings';
import { en } from './en';
import { es, type StringKey } from './es';
import { FRAGMENTS_EN, PHRASES_EN } from './phrases';

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

/** True when `key` names a string, for data-driven keys such as `ability.<id>.name`. */
export function hasKey(key: string): key is StringKey {
  return key in es;
}

/**
 * Translates Spanish text that comes from a gameplay data table rather than a UI key.
 * Exact phrases win; generated stat lines fall back to fragment substitution.
 */
export function td(source: string) {
  if (current === 'es') return source;
  const exact = PHRASES_EN[source];
  if (exact) return exact;
  // Generated item names: a translatable base plus a model suffix such as `MK-3`.
  const model = /^(.*) (MK-\d+)$/.exec(source);
  if (model && PHRASES_EN[model[1]]) return `${PHRASES_EN[model[1]]} ${model[2]}`;
  let text = source;
  for (const [spanish, english] of FRAGMENTS_EN) text = text.split(spanish).join(english);
  return text;
}

/** Localized name and description for a level-up ability, falling back to its data. */
export function abilityText(ability: { id: string; name: string; description: string }) {
  const name = `ability.${ability.id}.name`;
  const desc = `ability.${ability.id}.desc`;
  return {
    name: hasKey(name) ? t(name) : ability.name,
    description: hasKey(desc) ? t(desc) : ability.description,
  };
}
