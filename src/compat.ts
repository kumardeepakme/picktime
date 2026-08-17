/**
 * v2 compatibility shim.
 *
 * v2's API attached a picker to an existing text input. That input is kept in
 * the DOM and mirrored, so legacy code reading `inputEl.value` or listening for
 * its `change` event keeps working while the real control is the new element.
 */

import type { HourCycle, Meridiem } from './controller.js';
import type { PickTimeElement } from './element.js';
import { formatTime } from './format.js';

export interface LegacyTime {
  hours: number;
  minutes: number;
  meridiem?: string | null;
}

export interface LegacyOptions {
  animation?: string;
  arrow?: boolean;
  clock?: 12 | 24;
  minuteSteps?: number;
  offset?: { left?: number; top?: number };
  theme?: string;
  time?: LegacyTime;
  upDownKeys?: boolean;
  wheelSpin?: boolean;
}

export interface LegacyTimeOutput {
  displayTime: string;
  meridiem: Meridiem | null;
  time: string;
  utcOffset: string;
}

let warned = false;
const warnOnce = (): void => {
  if (warned) return;
  warned = true;
  console.warn(
    '[picktime] `new PickTime(input, options)` is deprecated. Use the ' +
      '<pick-time> element directly; see the v2 to v3 migration guide.'
  );
};

const utcOffset = (): string => {
  const total = new Date().getTimezoneOffset();
  const sign = total <= 0 ? '+' : '-';
  const hours = Math.floor(Math.abs(total) / 60);
  const minutes = Math.abs(total) % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export class PickTime {
  readonly element: PickTimeElement;
  readonly #input: HTMLInputElement;
  readonly #hourCycle: HourCycle;
  readonly #originalHidden: string | null;
  readonly #originalDisabled: boolean;
  readonly #originalValue: string;

  constructor(input: HTMLInputElement, options: LegacyOptions = {}) {
    warnOnce();

    if (input?.tagName !== 'INPUT') {
      throw new TypeError('picktime: first argument must be an input element');
    }

    this.#input = input;
    this.#hourCycle = options.clock === 24 ? 'h23' : 'h12';
    this.#originalHidden = input.getAttribute('hidden');
    this.#originalDisabled = input.disabled;
    this.#originalValue = input.value;

    const element = document.createElement('pick-time') as PickTimeElement;
    element.setAttribute('hour-cycle', this.#hourCycle);
    if (options.minuteSteps) {
      element.setAttribute('minute-step', String(options.minuteSteps));
    }
    if (options.theme) element.setAttribute('theme', options.theme);
    if (options.offset?.top !== undefined) {
      element.setAttribute('offset', String(options.offset.top));
    }
    if (input.name) element.setAttribute('name', input.name);

    if (options.time) {
      const { hours = 0, minutes = 0, meridiem } = options.time;
      const base = hours % 12;
      const resolved =
        options.clock === 24
          ? hours
          : String(meridiem).toLowerCase() === 'pm'
            ? base + 12
            : base;
      element.setAttribute(
        'value',
        `${String(resolved).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      );
    }

    // `hidden` alone would still submit, producing a duplicate field under the
    // same name whose value is the display string. Disabling takes it out of
    // form submission while leaving `input.value` readable by legacy code.
    input.hidden = true;
    input.disabled = true;
    input.insertAdjacentElement('afterend', element);
    this.element = element;

    element.addEventListener('change', this.#mirror);
    this.#mirror();
  }

  #mirror = (): void => {
    const seconds = this.element.valueAsNumber;
    this.#input.value =
      seconds === null
        ? ''
        : formatTime(seconds, { hourCycle: this.#hourCycle });
    this.#input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  setTime({ hours, minutes, meridiem }: LegacyTime): void {
    const base = hours % 12;
    const resolved =
      this.#hourCycle === 'h23'
        ? hours
        : String(meridiem).toLowerCase() === 'pm'
          ? base + 12
          : base;
    this.element.value = `${String(resolved).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    this.#mirror();
  }

  disable(): void {
    this.element.disabled = true;
  }

  enable(): void {
    this.element.disabled = false;
  }

  destroy(): void {
    this.element.removeEventListener('change', this.#mirror);
    this.element.remove();
    if (this.#originalHidden === null) this.#input.removeAttribute('hidden');
    else this.#input.setAttribute('hidden', this.#originalHidden);
    this.#input.disabled = this.#originalDisabled;
    this.#input.value = this.#originalValue;
  }

  get getTime(): LegacyTimeOutput {
    const seconds = this.element.valueAsNumber;
    if (seconds === null) {
      return {
        displayTime: '',
        meridiem: null,
        time: '',
        utcOffset: utcOffset(),
      };
    }
    return {
      displayTime: formatTime(seconds, { hourCycle: this.#hourCycle }),
      meridiem:
        this.#hourCycle === 'h12'
          ? (this.element.valueAsObject?.meridiem ?? null)
          : null,
      time: this.element.value,
      utcOffset: utcOffset(),
    };
  }
}
