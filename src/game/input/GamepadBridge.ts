/**
 * Standard-mapping gamepad support without touching every scene.
 *
 * During live combat the frame is handed to one gameplay consumer (GameScene) as analog input.
 * Everywhere else — menus, level-up cards, pause, results — buttons are replayed as the
 * keyboard keys those screens already answer to, so every keyboard-accessible screen is also
 * gamepad-accessible with no per-screen code.
 */
export const PAD = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
} as const;

export interface Vec { x: number; y: number }

export interface PadFrame {
  movement: Vec;
  aim: Vec;
  /** Right stick deflected past the aim threshold. */
  aiming: boolean;
  firing: boolean;
  justPressed: ReadonlySet<number>;
  /** Any stick deflection or held button this frame. */
  active: boolean;
}

const STICK_DEADZONE = 0.22;
const AIM_THRESHOLD = 0.35;
const TRIGGER_THRESHOLD = 0.3;
const NAV_THRESHOLD = 0.6;

/** Radial deadzone rescaled to 0..1 so small deflections still start at zero speed. */
export function applyDeadzone(x: number, y: number, deadzone = STICK_DEADZONE): Vec {
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (length - deadzone) / (1 - deadzone));
  return { x: (x / length) * scaled, y: (y / length) * scaled };
}

export interface PadReading {
  axes: readonly number[];
  pressed: readonly boolean[];
  values: readonly number[];
}

export function readPad(pad: Pick<Gamepad, 'axes' | 'buttons'>): PadReading {
  return {
    axes: pad.axes,
    pressed: pad.buttons.map(button => button.pressed),
    values: pad.buttons.map(button => button.value),
  };
}

/** Pure frame builder: current reading plus last frame's pressed states. */
export function buildFrame(reading: PadReading, previous: readonly boolean[]): PadFrame {
  const movement = applyDeadzone(reading.axes[0] ?? 0, reading.axes[1] ?? 0);
  const rawAim = { x: reading.axes[2] ?? 0, y: reading.axes[3] ?? 0 };
  const aiming = Math.hypot(rawAim.x, rawAim.y) > AIM_THRESHOLD;
  // D-pad moves too, for pads whose left stick is worn or for players who prefer it.
  if (movement.x === 0 && movement.y === 0) {
    movement.x = Number(Boolean(reading.pressed[PAD.RIGHT])) - Number(Boolean(reading.pressed[PAD.LEFT]));
    movement.y = Number(Boolean(reading.pressed[PAD.DOWN])) - Number(Boolean(reading.pressed[PAD.UP]));
  }
  const justPressed = new Set<number>();
  reading.pressed.forEach((pressed, index) => { if (pressed && !previous[index]) justPressed.add(index); });
  const firing = aiming || (reading.values[PAD.RT] ?? 0) > TRIGGER_THRESHOLD;
  const active = movement.x !== 0 || movement.y !== 0 || aiming || reading.pressed.some(Boolean);
  return { movement, aim: aiming ? rawAim : { x: 0, y: 0 }, aiming, firing, justPressed, active };
}

/** Edge-triggered navigation from the left stick, so a held stick moves focus once. */
export function stickDirection(axes: readonly number[]): 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | undefined {
  const x = axes[0] ?? 0;
  const y = axes[1] ?? 0;
  if (Math.max(Math.abs(x), Math.abs(y)) < NAV_THRESHOLD) return undefined;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'RIGHT' : 'LEFT';
  return y > 0 ? 'DOWN' : 'UP';
}

const KEYS = {
  Enter: 13, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, I: 73,
} as const;
type SyntheticKey = keyof typeof KEYS;

function dispatchKey(key: SyntheticKey) {
  for (const type of ['keydown', 'keyup'] as const) {
    const event = new KeyboardEvent(type, { key: key === 'I' ? 'i' : key, bubbles: true });
    // `keyCode` cannot be set through the constructor, and Phaser's keyboard reads it.
    Object.defineProperty(event, 'keyCode', { get: () => KEYS[key] });
    Object.defineProperty(event, 'which', { get: () => KEYS[key] });
    window.dispatchEvent(event);
  }
}

/** Returns true when it used the frame for live gameplay; false leaves it to menu navigation. */
export type GameplayConsumer = (frame: PadFrame) => boolean;

let consumer: GameplayConsumer | undefined;
let previous: boolean[] = [];
let previousDirection: string | undefined;
let installed = false;

export function setGamepadConsumer(next: GameplayConsumer | undefined) {
  consumer = next;
}

export function connectedPad(): Gamepad | undefined {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return undefined;
  return navigator.getGamepads().find((pad): pad is Gamepad => Boolean(pad && pad.connected));
}

export function pollGamepad() {
  const pad = connectedPad();
  if (!pad) {
    previous = [];
    previousDirection = undefined;
    return;
  }
  const reading = readPad(pad);
  const frame = buildFrame(reading, previous);
  previous = [...reading.pressed];
  // Pause and inventory are the same key on every screen, live or not.
  if (frame.justPressed.has(PAD.START)) dispatchKey('Escape');
  if (frame.justPressed.has(PAD.BACK)) dispatchKey('I');
  if (consumer?.(frame)) {
    previousDirection = undefined;
    return;
  }
  const direction = stickDirection(reading.axes);
  if (direction && direction !== previousDirection) dispatchKey(`Arrow${direction[0]}${direction.slice(1).toLowerCase()}` as SyntheticKey);
  previousDirection = direction;
  if (frame.justPressed.has(PAD.UP)) dispatchKey('ArrowUp');
  if (frame.justPressed.has(PAD.DOWN)) dispatchKey('ArrowDown');
  if (frame.justPressed.has(PAD.LEFT)) dispatchKey('ArrowLeft');
  if (frame.justPressed.has(PAD.RIGHT)) dispatchKey('ArrowRight');
  if (frame.justPressed.has(PAD.A)) dispatchKey('Enter');
  if (frame.justPressed.has(PAD.B)) dispatchKey('Escape');
}

/** Polls once per game step. Browsers only expose pads after a button press on the page. */
export function installGamepadBridge(game: { events: { on: (event: string, fn: () => void) => void } }) {
  if (installed) return;
  installed = true;
  game.events.on('prestep', pollGamepad);
}
