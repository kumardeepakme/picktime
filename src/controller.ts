/**
 * Headless time state. No DOM, no formatting, no side effects.
 *
 * Time is stored as a single "seconds of day" integer rather than a
 * {hours, minutes, meridiem} triple. That one change removes most of the
 * arithmetic bugs the v2 implementation carried, because there is only ever
 * one number to keep consistent.
 */

export const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;

export type HourCycle = 'h11' | 'h12' | 'h23' | 'h24';
export type Meridiem = 'am' | 'pm';
export type TimeField = 'hours' | 'minutes' | 'seconds';

export interface TimeParts {
  hours: number;
  minutes: number;
  seconds: number;
}

export interface TimeValidity {
  badInput: boolean;
  valueMissing: boolean;
  rangeUnderflow: boolean;
  rangeOverflow: boolean;
}

export interface TimeControllerOptions {
  hourCycle?: HourCycle | undefined;
  minuteStep?: number | undefined;
  secondStep?: number | undefined;
  withSeconds?: boolean | undefined;
  min?: string | null | undefined;
  max?: string | null | undefined;
  required?: boolean | undefined;
}

/** Euclidean modulo. `-15 % 60` is -15 in JS; this returns 45. */
const mod = (n: number, m: number): number => ((n % m) + m) % m;

export const toSecondsOfDay = ({
  hours,
  minutes,
  seconds,
}: TimeParts): number =>
  hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds;

export const fromSecondsOfDay = (value: number): TimeParts => {
  const total = mod(Math.trunc(value), SECONDS_PER_DAY);
  return {
    hours: Math.floor(total / SECONDS_PER_HOUR),
    minutes: Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds: total % SECONDS_PER_MINUTE,
  };
};

const TIME_VALUE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/**
 * Parses the machine format only (`HH:mm` / `HH:mm:ss`), the same shape
 * `<input type="time">.value` uses. Lenient human input is `parse.ts`'s job.
 *
 * Returns `null` for invalid input. Note that a valid `"00:00"` yields `0`,
 * so callers must compare against `null` and never rely on truthiness.
 */
export const parseTimeValue = (value: string): number | null => {
  const match = TIME_VALUE.exec(value.trim());
  if (!match) return null;

  const [, hours = '0', minutes = '0', seconds = '0'] = match;
  return toSecondsOfDay({
    hours: Number(hours),
    minutes: Number(minutes),
    seconds: Number(seconds),
  });
};

export const toTimeValue = (value: number, withSeconds = false): string => {
  const { hours, minutes, seconds } = fromSecondsOfDay(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = `${pad(hours)}:${pad(minutes)}`;
  return withSeconds ? `${base}:${pad(seconds)}` : base;
};

/** `h11`/`h12` show a 12-hour dial and therefore need a meridiem control. */
export const is12HourCycle = (cycle: HourCycle): boolean =>
  cycle === 'h11' || cycle === 'h12';

export const toDisplayHours = (hours: number, cycle: HourCycle): number => {
  switch (cycle) {
    case 'h11':
      return hours % 12;
    case 'h12':
      return hours % 12 === 0 ? 12 : hours % 12;
    case 'h24':
      return hours === 0 ? 24 : hours;
    default:
      return hours;
  }
};

export class TimeController {
  #seconds: number | null = null;
  #badInput = false;
  #withSeconds = false;

  hourCycle: HourCycle;
  minuteStep: number;
  secondStep: number;
  required: boolean;
  min: string | null;
  max: string | null;

  constructor(options: TimeControllerOptions = {}) {
    this.hourCycle = options.hourCycle ?? 'h12';
    this.minuteStep = options.minuteStep ?? 1;
    this.secondStep = options.secondStep ?? 1;
    this.withSeconds = options.withSeconds ?? false;
    this.required = options.required ?? false;
    this.min = options.min ?? null;
    this.max = options.max ?? null;
  }

  get value(): string | null {
    return this.#seconds === null
      ? null
      : toTimeValue(this.#seconds, this.withSeconds);
  }

  set value(next: string | null) {
    if (next === null || next === '') {
      this.#seconds = null;
      this.#badInput = false;
      return;
    }

    // Unparseable input clears the value rather than silently keeping the
    // previous one, matching how <input type="time"> sanitises an assignment.
    const parsed = parseTimeValue(next);
    this.#badInput = parsed === null;
    this.#seconds =
      parsed === null || this.#withSeconds
        ? parsed
        : parsed - (parsed % SECONDS_PER_MINUTE);
  }

  /** Seconds since midnight, or `null` when empty. */
  get secondsOfDay(): number | null {
    return this.#seconds;
  }

  set secondsOfDay(next: number | null) {
    const normalised =
      next === null || !Number.isFinite(next)
        ? null
        : mod(Math.trunc(next), SECONDS_PER_DAY);
    this.#seconds =
      normalised === null || this.#withSeconds
        ? normalised
        : normalised - (normalised % SECONDS_PER_MINUTE);
    this.#badInput = false;
  }

  get withSeconds(): boolean {
    return this.#withSeconds;
  }

  set withSeconds(next: boolean) {
    this.#withSeconds = next;
    if (!next && this.#seconds !== null) {
      this.#seconds -= this.#seconds % SECONDS_PER_MINUTE;
    }
  }

  /** Marks an unparseable human edit without discarding the last good value. */
  setBadInput(next: boolean): void {
    this.#badInput = next;
  }

  get parts(): TimeParts | null {
    return this.#seconds === null ? null : fromSecondsOfDay(this.#seconds);
  }

  get meridiem(): Meridiem | null {
    if (this.#seconds === null) return null;
    return fromSecondsOfDay(this.#seconds).hours < 12 ? 'am' : 'pm';
  }

  set meridiem(next: Meridiem) {
    if (this.#seconds === null) return;
    if (this.meridiem === next) return;
    this.#seconds = mod(
      this.#seconds + (next === 'pm' ? 12 : -12) * SECONDS_PER_HOUR,
      SECONDS_PER_DAY
    );
  }

  get displayHours(): number | null {
    const parts = this.parts;
    return parts === null ? null : toDisplayHours(parts.hours, this.hourCycle);
  }

  /**
   * Steps one field, wrapping within that field only.
   *
   * Fields do not carry into one another: incrementing 09:59 by a minute gives
   * 09:00, not 10:00. This matches `<input type="time">`, where each segment is
   * an independent spinbutton, and is what the ARIA spinbutton role implies.
   */
  step(field: TimeField, direction: number): void {
    const delta = Math.sign(direction);
    if (delta === 0) return;

    const parts = this.parts ?? { hours: 0, minutes: 0, seconds: 0 };

    if (field === 'hours') {
      const next = is12HourCycle(this.hourCycle)
        ? // Wrap inside the current 12-hour half so AM/PM is preserved.
          Math.floor(parts.hours / 12) * 12 +
          mod((parts.hours % 12) + delta, 12)
        : mod(parts.hours + delta, 24);
      parts.hours = next;
    } else if (field === 'minutes') {
      parts.minutes = mod(parts.minutes + delta * this.minuteStep, 60);
    } else {
      parts.seconds = mod(parts.seconds + delta * this.secondStep, 60);
    }

    this.#seconds = toSecondsOfDay(parts);
    this.#badInput = false;
  }

  #bound(raw: string | null): number | null {
    return raw === null ? null : parseTimeValue(raw);
  }

  /**
   * A reversed range (min > max) describes a window that crosses midnight,
   * e.g. min="22:00" max="06:00" for a night shift. The HTML spec defines this
   * behaviour for `<input type="time">`, so it is mirrored here.
   */
  get inRange(): boolean {
    const value = this.#seconds;
    if (value === null) return true;

    const min = this.#bound(this.min);
    const max = this.#bound(this.max);
    if (min === null && max === null) return true;
    if (min !== null && max !== null && min > max) {
      return value >= min || value <= max;
    }
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
  }

  get validity(): TimeValidity {
    const value = this.#seconds;
    const min = this.#bound(this.min);
    const max = this.#bound(this.max);
    const reversed = min !== null && max !== null && min > max;
    const outOfRange = !this.inRange;

    return {
      badInput: this.#badInput,
      valueMissing: this.required && value === null,
      rangeUnderflow: reversed
        ? outOfRange
        : value !== null && min !== null && value < min,
      rangeOverflow: reversed
        ? outOfRange
        : value !== null && max !== null && value > max,
    };
  }

  get valid(): boolean {
    return !Object.values(this.validity).some(Boolean);
  }
}
