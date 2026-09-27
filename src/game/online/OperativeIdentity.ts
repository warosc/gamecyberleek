/**
 * The player's online identity: a secret "operative code" that keys their cloud save and
 * leaderboard entries, and a public callsign shown on boards. Generated on the device; the
 * server stores only a hash of the code.
 */
export interface OperativeIdentity {
  code: string;
  callsign: string;
}

/** 32 symbols without I, O, 0 or 1, so a code read aloud or typed from a photo stays unambiguous. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/;
export const CALLSIGN_PATTERN = /^[A-Z0-9-]{3,16}$/;

function randomBytes(count: number) {
  const bytes = new Uint8Array(count);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function generateCode() {
  const symbols = [...randomBytes(16)].map(byte => ALPHABET[byte % ALPHABET.length]);
  return [0, 4, 8, 12].map(start => symbols.slice(start, start + 4).join('')).join('-');
}

export function generateCallsign() {
  const [a, b] = randomBytes(2);
  return `OPERATIVO-${String(((a << 8) | b) % 10000).padStart(4, '0')}`;
}

/** Accepts what a person types: lower case, spaces or missing dashes. */
export function normalizeCode(input: string) {
  const symbols = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (symbols.length !== 16) return undefined;
  const code = [0, 4, 8, 12].map(start => symbols.slice(start, start + 4)).join('-');
  return CODE_PATTERN.test(code) ? code : undefined;
}

export function normalizeCallsign(input: string) {
  const callsign = input.toUpperCase().trim().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '').slice(0, 16);
  return CALLSIGN_PATTERN.test(callsign) ? callsign : undefined;
}

export function normalizeIdentity(value: unknown): OperativeIdentity | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<Record<keyof OperativeIdentity, unknown>>;
  const code = typeof raw.code === 'string' ? normalizeCode(raw.code) : undefined;
  const callsign = typeof raw.callsign === 'string' ? normalizeCallsign(raw.callsign) : undefined;
  return code && callsign ? { code, callsign } : undefined;
}
