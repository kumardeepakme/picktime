/**
 * <pick-time> - a form-associated time picker custom element.
 *
 * Design notes:
 * - The controller owns all time state; this file only renders it and turns
 *   user gestures into controller calls. Display is always derived, never
 *   stored, which is what stops value and label drifting apart.
 * - Every listener is registered with the same AbortSignal, so disconnecting
 *   tears down the whole component with one abort() and cannot leak.
 * - The panel is a real popover, so the top layer, light dismiss and Escape
 *   are the browser's job rather than ours.
 */

import {
  type HourCycle,
  is12HourCycle,
  type Meridiem,
  TimeController,
  type TimeField,
  toTimeValue,
} from './controller.js';
import {
  describeField,
  describeTime,
  formatTime,
  getDayPeriodNames,
  resolveHourCycle,
} from './format.js';
import { parseHumanTime } from './parse.js';
import {
  createPositioner,
  type Placement,
  type Positioner,
} from './position.js';
import styles from './styles.css?inline';

let sheet: CSSStyleSheet | undefined;
const styleSheet = (): CSSStyleSheet => {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
  }
  return sheet;
};

const ARROW_PATH =
  'M0 6s1.796-.013 4.67-3.615C5.851.9 6.93.006 8 0s2.148.887 3.343 2.385C14.233 6.005 16 6 16 6z';
const ARROW_SVG = `<svg width="16" height="6" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${ARROW_PATH}"/></svg>`;

const TEMPLATE = /* html */ `
  <input class="field" part="input" type="text" inputmode="text"
         autocomplete="off" autocorrect="off" spellcheck="false"
         aria-controls="picker">
  <div class="picker" id="picker" part="picker" popover="auto" role="dialog"
       aria-label="Choose time">
    <div class="body">
      <span class="spin" part="spin hours" role="spinbutton" tabindex="0"
            data-field="hours"></span>
      <div class="dots" part="separator" aria-hidden="true"></div>
      <span class="spin" part="spin minutes" role="spinbutton" tabindex="0"
            data-field="minutes"></span>
      <div class="dots seconds-only" part="separator" aria-hidden="true"></div>
      <span class="spin seconds-only" part="spin seconds" role="spinbutton"
            tabindex="0" data-field="seconds"></span>
      <div class="meridiem" part="meridiem" role="radiogroup">
        <button class="period" part="period" type="button" role="radio"
                data-period="am"></button>
        <button class="period" part="period" type="button" role="radio"
                data-period="pm"></button>
      </div>
    </div>
    <div class="arrow" part="arrow">${ARROW_SVG}${ARROW_SVG}</div>
  </div>
  <div class="sr-only" aria-live="polite" role="status"></div>
`;

/**
 * `h11`/`h12`/`h23`/`h24` are the CLDR names Intl uses, and they are what the
 * property reports. The plain `12` and `24` aliases exist because that is how
 * people actually describe a clock (and what v2's `clock` option accepted).
 */
const HOUR_CYCLE_ALIASES: Record<string, HourCycle> = {
  '12': 'h12',
  '12h': 'h12',
  h11: 'h11',
  h12: 'h12',
  '24': 'h23',
  '24h': 'h23',
  h23: 'h23',
  h24: 'h24',
};

const BOOLEAN_ATTRS = ['seconds', 'disabled', 'required', 'readonly'] as const;

const FIELD_RANGE: Record<
  TimeField,
  (cycle: HourCycle) => { min: number; max: number }
> = {
  hours: cycle => {
    switch (cycle) {
      case 'h11':
        return { min: 0, max: 11 };
      case 'h12':
        return { min: 1, max: 12 };
      case 'h24':
        return { min: 1, max: 24 };
      default:
        return { min: 0, max: 23 };
    }
  },
  minutes: () => ({ min: 0, max: 59 }),
  seconds: () => ({ min: 0, max: 59 }),
};

export class PickTimeElement extends HTMLElement {
  static formAssociated = true;

  static observedAttributes = [
    'value',
    'min',
    'max',
    'minute-step',
    'second-step',
    'hour-cycle',
    'locale',
    'placement',
    'offset',
    'placeholder',
    'aria-label',
    ...BOOLEAN_ATTRS,
  ];

  readonly #internals: ElementInternals;
  readonly #controller = new TimeController();
  readonly #root: ShadowRoot;

  #abort: AbortController | null = null;
  #positioner: Positioner | null = null;
  #dismissedAt = 0;
  #restoreFocus = false;
  #dirty = false;
  #formDisabled = false;

  readonly #field: HTMLInputElement;
  readonly #picker: HTMLElement;
  readonly #arrow: HTMLElement;
  readonly #status: HTMLElement;
  readonly #meridiem: HTMLElement;
  readonly #spins: Map<TimeField, HTMLElement>;
  readonly #periods: Map<Meridiem, HTMLButtonElement>;
  #focusFirstOnOpen = true;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#root = this.attachShadow({ mode: 'open', delegatesFocus: true });
    this.#root.adoptedStyleSheets = [styleSheet()];
    this.#root.innerHTML = TEMPLATE;

    const query = <T extends Element>(selector: string): T => {
      const found = this.#root.querySelector<T>(selector);
      if (!found) throw new Error(`picktime: missing ${selector}`);
      return found;
    };

    this.#field = query<HTMLInputElement>('.field');
    this.#picker = query<HTMLElement>('.picker');
    this.#arrow = query<HTMLElement>('.arrow');
    this.#status = query<HTMLElement>('.sr-only');
    this.#meridiem = query<HTMLElement>('.meridiem');

    this.#spins = new Map(
      (['hours', 'minutes', 'seconds'] as const).map(field => [
        field,
        query<HTMLElement>(`[data-field="${field}"]`),
      ])
    );
    this.#periods = new Map(
      (['am', 'pm'] as const).map(period => [
        period,
        query<HTMLButtonElement>(`[data-period="${period}"]`),
      ])
    );
  }

  /* Lifecycle ------------------------------------------------------------ */

  connectedCallback(): void {
    this.#abort = new AbortController();
    this.#bind(this.#abort.signal);
    this.#syncFromAttributes();
    // Must go through #commit, not #render: connecting is the first chance to
    // publish the form value and validity, and skipping it leaves the element
    // invisible to FormData and to form.checkValidity().
    this.#commit({ emit: false });
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#abort = null;
    this.#positioner?.stop();
    this.#positioner = null;
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    this.#syncFromAttributes();
    this.#commit({ emit: false });
    if ((name === 'placement' || name === 'offset') && this.open) {
      this.#startPositioner();
    }
  }

  /* Public API ----------------------------------------------------------- */

  get value(): string {
    return this.#controller.value ?? '';
  }

  set value(next: string) {
    this.#dirty = true;
    this.#controller.value = next === '' ? null : next;
    this.#commit({ emit: false });
  }

  /** Structured view of the value, or `null` when empty. */
  get valueAsObject(): {
    hours: number;
    minutes: number;
    seconds: number;
    meridiem: Meridiem | null;
  } | null {
    const parts = this.#controller.parts;
    if (!parts) return null;
    return { ...parts, meridiem: this.#controller.meridiem };
  }

  /** Seconds since midnight, or `null` when empty. */
  get valueAsNumber(): number | null {
    return this.#controller.secondsOfDay;
  }

  set valueAsNumber(next: number | null) {
    this.#dirty = true;
    this.#controller.secondsOfDay = next;
    this.#commit({ emit: false });
  }

  get name(): string {
    return this.getAttribute('name') ?? '';
  }

  set name(next: string) {
    this.setAttribute('name', next);
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }

  get labels(): NodeList {
    return this.#internals.labels;
  }

  get validity(): ValidityState {
    return this.#internals.validity;
  }

  get validationMessage(): string {
    return this.#internals.validationMessage;
  }

  get willValidate(): boolean {
    return this.#internals.willValidate;
  }

  checkValidity(): boolean {
    return this.#internals.checkValidity();
  }

  reportValidity(): boolean {
    return this.#internals.reportValidity();
  }

  override focus(options?: FocusOptions): void {
    this.#field.focus(options);
  }

  /** Opens the picker. Mirrors `<input type="time">.showPicker()`. */
  showPicker(): void {
    if (this.#isInert) return;
    if (this.#picker.matches(':popover-open')) return;
    this.#focusFirstOnOpen = true;
    this.#picker.showPopover();
  }

  hidePicker(): void {
    if (this.#picker.matches(':popover-open')) this.#picker.hidePopover();
  }

  get open(): boolean {
    return this.#picker.matches(':popover-open');
  }

  /* Reflected attributes -------------------------------------------------- */

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(next: boolean) {
    this.toggleAttribute('disabled', next);
  }

  get required(): boolean {
    return this.hasAttribute('required');
  }
  set required(next: boolean) {
    this.toggleAttribute('required', next);
  }

  get readOnly(): boolean {
    return this.hasAttribute('readonly');
  }
  set readOnly(next: boolean) {
    this.toggleAttribute('readonly', next);
  }

  get seconds(): boolean {
    return this.hasAttribute('seconds');
  }
  set seconds(next: boolean) {
    this.toggleAttribute('seconds', next);
  }

  get min(): string {
    return this.getAttribute('min') ?? '';
  }
  set min(next: string) {
    this.setAttribute('min', next);
  }

  get max(): string {
    return this.getAttribute('max') ?? '';
  }
  set max(next: string) {
    this.setAttribute('max', next);
  }

  get hourCycle(): HourCycle {
    return this.#controller.hourCycle;
  }
  set hourCycle(next: HourCycle) {
    this.setAttribute('hour-cycle', next);
  }

  get locale(): string {
    return this.getAttribute('locale') ?? '';
  }
  set locale(next: string) {
    this.setAttribute('locale', next);
  }

  get minuteStep(): number {
    return this.#controller.minuteStep;
  }
  set minuteStep(next: number) {
    this.setAttribute('minute-step', String(next));
  }

  get secondStep(): number {
    return this.#controller.secondStep;
  }
  set secondStep(next: number) {
    this.setAttribute('second-step', String(next));
  }

  get placement(): Placement {
    return this.#placement;
  }
  set placement(next: Placement) {
    this.setAttribute('placement', next);
  }

  get offset(): number {
    return this.#offset;
  }
  set offset(next: number) {
    this.setAttribute('offset', String(next));
  }

  get placeholder(): string {
    return this.getAttribute('placeholder') ?? '';
  }
  set placeholder(next: string) {
    this.setAttribute('placeholder', next);
  }

  get theme(): string {
    return this.getAttribute('theme') ?? '';
  }
  set theme(next: string) {
    this.setAttribute('theme', next);
  }

  get animation(): string {
    return this.getAttribute('animation') ?? '';
  }
  set animation(next: string) {
    this.setAttribute('animation', next);
  }

  /* Form callbacks -------------------------------------------------------- */

  formResetCallback(): void {
    this.#dirty = false;
    this.#internals.states.delete('user-invalid');
    this.#controller.value = this.getAttribute('value');
    this.#commit({ emit: false });
  }

  formDisabledCallback(disabled: boolean): void {
    // Kept separate from the `disabled` attribute: a disabled ancestor
    // <fieldset> disables the control without touching its markup, and
    // #syncFromAttributes must not clobber that.
    this.#formDisabled = disabled;
    if (disabled) this.hidePicker();
    if (this.isConnected) this.#render();
  }

  formStateRestoreCallback(state: string | null): void {
    this.#dirty = true;
    this.#controller.value = state;
    this.#commit({ emit: false });
  }

  /* Internals ------------------------------------------------------------- */

  get #effectiveLocale(): string | undefined {
    if (!this.locale) return undefined;
    try {
      return new Intl.Locale(this.locale).toString();
    } catch {
      return undefined;
    }
  }

  /** Disabled by its own attribute or by an ancestor such as <fieldset>. */
  get #isDisabled(): boolean {
    return this.disabled || this.#formDisabled;
  }

  /** Any state in which user gestures must not change the value. */
  get #isInert(): boolean {
    return this.#isDisabled || this.readOnly;
  }

  #syncFromAttributes(): void {
    const controller = this.#controller;
    const cycle = this.getAttribute('hour-cycle')?.trim().toLowerCase();

    controller.hourCycle =
      (cycle ? HOUR_CYCLE_ALIASES[cycle] : undefined) ??
      resolveHourCycle(this.#effectiveLocale);

    const minuteStep = Number(this.getAttribute('minute-step'));
    controller.minuteStep =
      Number.isInteger(minuteStep) && minuteStep > 0 && minuteStep < 60
        ? minuteStep
        : 1;

    const secondStep = Number(this.getAttribute('second-step'));
    controller.secondStep =
      Number.isInteger(secondStep) && secondStep > 0 && secondStep < 60
        ? secondStep
        : 1;

    controller.withSeconds = this.seconds;
    controller.required = this.required;
    controller.min = this.getAttribute('min');
    controller.max = this.getAttribute('max');

    // The `value` attribute is the default value; once the user has edited,
    // it no longer overrides what they picked. This mirrors <input>.
    if (!this.#dirty) controller.value = this.getAttribute('value');

    this.#field.disabled = this.#isDisabled;
    this.#field.readOnly = this.readOnly;
    this.#field.required = this.required;
  }

  #bind(signal: AbortSignal): void {
    const on = <K extends keyof HTMLElementEventMap>(
      target: EventTarget,
      type: K | string,
      handler: (event: never) => void,
      options?: AddEventListenerOptions
    ): void => {
      target.addEventListener(type, handler as EventListener, {
        signal,
        ...options,
      });
    };

    // Opening must happen on `click`, i.e. after pointerup. Opening during
    // pointerdown makes the popover's own light dismiss fire on the matching
    // pointerup and close it again, which reads as "click does nothing".
    on(this, 'click', (event: MouseEvent) => {
      // Label activation dispatches a click on the labelled custom element.
      // Focus the real input, but leave clicks originating inside the shadow
      // tree to their own handlers.
      if (!event.composedPath().includes(this.#root)) this.focus();
    });
    on(this.#field, 'click', () => {
      if (this.#isInert) return;
      // Clicking an open picker light-dismisses it first; treat that as the
      // close half of a toggle instead of reopening.
      if (performance.now() - this.#dismissedAt < 250) return;
      if (this.open) this.hidePicker();
      else {
        // A normal click is also the entry point for typing. Keep focus in the
        // text field; ArrowDown and the public showPicker() method explicitly
        // move into the spinbuttons.
        this.#focusFirstOnOpen = false;
        this.#picker.showPopover();
      }
    });
    on(this.#field, 'input', (event: Event) => {
      // The inner input's native `input` is composed, so it would cross the
      // shadow boundary and be retargeted onto the host, where consumers
      // cannot tell it apart from the one we emit on commit. The component
      // owns its event contract, so keep internal ones internal.
      event.stopPropagation();
      this.#dirty = true;
    });
    on(this.#field, 'change', () => this.#commitTypedValue());
    on(this.#field, 'blur', () => this.#commitTypedValue());
    on(this.#field, 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.#commitTypedValue();
      } else if (event.key === 'ArrowDown' && !this.open) {
        event.preventDefault();
        this.showPicker();
      }
    });

    // `beforetoggle` is synchronous; `toggle` is queued. The dismiss timestamp
    // has to be recorded synchronously, or the click that caused the light
    // dismiss still sees the picker as closed and reopens it.
    on(this.#picker, 'beforetoggle', (event: ToggleEvent) => {
      if (event.newState !== 'closed') return;
      this.#dismissedAt = performance.now();
      // Sampled here, while the panel is still rendered: by the time `toggle`
      // runs the panel is display:none and focus has already moved.
      const active = this.#root.activeElement;
      this.#restoreFocus = !!active && this.#picker.contains(active);
    });

    on(this.#picker, 'keydown', (event: KeyboardEvent) => this.#trapTab(event));

    on(this.#picker, 'toggle', (event: ToggleEvent) => {
      this.#field.setAttribute(
        'aria-expanded',
        String(event.newState === 'open')
      );
      if (event.newState === 'open') {
        // Built fresh on every open. Caching it snapshotted `placement` and
        // `offset` at the first open, so later changes to either were ignored.
        this.#startPositioner();
        if (this.#focusFirstOnOpen) {
          this.#spins.get('hours')?.focus({ preventScroll: true });
        }
        this.#focusFirstOnOpen = true;
      } else {
        this.#positioner?.stop();
        // Only reclaim focus if it was still inside the panel we just closed;
        // a light dismiss onto some other control must not be stolen back.
        if (this.#restoreFocus) {
          this.#restoreFocus = false;
          this.#field.focus({ preventScroll: true });
        }
      }
    });

    for (const [field, spin] of this.#spins) {
      on(spin, 'click', () => {
        if (!this.#isInert) this.#step(field, 1);
      });
      on(spin, 'keydown', (event: KeyboardEvent) =>
        this.#onSpinKeyDown(event, field)
      );
      on(
        spin,
        'wheel',
        (event: WheelEvent) => {
          if (!event.deltaY || this.#isInert) return;
          event.preventDefault();
          this.#step(field, event.deltaY < 0 ? 1 : -1);
        },
        { passive: false }
      );
    }

    for (const [period, button] of this.#periods) {
      on(button, 'click', () => this.#setMeridiem(period));
      on(button, 'keydown', (event: KeyboardEvent) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        this.#setMeridiem(period === 'am' ? 'pm' : 'am');
      });
    }
  }

  /**
   * Focusable controls inside the panel, in DOM order. Hidden segments (the
   * seconds column, or the meridiem pair on a 24-hour clock) are excluded so
   * Tab never lands on something invisible.
   */
  get #focusables(): HTMLElement[] {
    return [...this.#spins.values(), ...this.#periods.values()].filter(
      el =>
        !el.hidden &&
        !el.closest('[hidden]') &&
        !(el as Partial<HTMLButtonElement>).disabled
    );
  }

  /**
   * Keeps Tab inside the open panel. A popover is not a modal dialog, so the
   * browser does not do this for us, and without it Tab walks off into the
   * page behind a panel the user can still see.
   */
  #trapTab(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const focusables = this.#focusables;
    if (focusables.length === 0) return;

    const active = this.#root.activeElement as HTMLElement | null;
    const index = active ? focusables.indexOf(active) : -1;
    const step = event.shiftKey ? -1 : 1;
    const next =
      focusables[
        index === -1
          ? 0
          : (index + step + focusables.length) % focusables.length
      ];

    event.preventDefault();
    next?.focus({ preventScroll: true });
  }

  get #placement(): Placement {
    const value = this.getAttribute('placement');
    return value === 'top' || value === 'left' || value === 'right'
      ? value
      : 'bottom';
  }

  get #offset(): number {
    const value = Number(this.getAttribute('offset'));
    return Number.isFinite(value) && this.hasAttribute('offset') ? value : 6;
  }

  #startPositioner(): void {
    this.#positioner?.stop();
    this.#positioner = createPositioner(this.#field, this.#picker, {
      placement: this.#placement,
      mainAxis: this.#offset,
      arrow: this.#arrow,
    });
    this.#positioner.start();
  }

  #onSpinKeyDown(event: KeyboardEvent, field: TimeField): void {
    if (this.#isInert) return;
    const big = field === 'hours' ? 6 : 10;

    switch (event.key) {
      case 'ArrowUp':
        this.#step(field, 1);
        break;
      case 'ArrowDown':
        this.#step(field, -1);
        break;
      case 'PageUp':
        for (let i = 0; i < big; i++) this.#step(field, 1);
        break;
      case 'PageDown':
        for (let i = 0; i < big; i++) this.#step(field, -1);
        break;
      case 'Home':
        this.#setField(field, FIELD_RANGE[field](this.hourCycle).min);
        break;
      case 'End':
        this.#setField(field, FIELD_RANGE[field](this.hourCycle).max);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  #step(field: TimeField, direction: number): void {
    this.#dirty = true;
    this.#controller.step(field, direction);
    this.#commit({ emit: true });
    this.#announceField(field);
  }

  #setField(field: TimeField, displayValue: number): void {
    const parts = this.#controller.parts ?? {
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
    if (field === 'hours') {
      const half = Math.floor(parts.hours / 12) * 12;
      parts.hours = is12HourCycle(this.hourCycle)
        ? half + (displayValue % 12)
        : displayValue % 24;
    } else {
      parts[field] = displayValue;
    }
    this.#dirty = true;
    this.#controller.value = toTimeValue(
      parts.hours * 3600 + parts.minutes * 60 + parts.seconds,
      true
    );
    this.#commit({ emit: true });
    this.#announceField(field);
  }

  #setMeridiem(period: Meridiem): void {
    if (this.#isInert) return;
    if (this.#controller.secondsOfDay === null)
      this.#controller.value = '00:00';
    this.#dirty = true;
    this.#controller.meridiem = period;
    this.#commit({ emit: true });
  }

  /**
   * Commits whatever is typed in the field.
   *
   * Reached from three places for one user gesture: the field's `change`, its
   * `blur`, and Enter. Committing is therefore idempotent - it only emits when
   * the value actually moved, so a single edit produces a single `change`.
   */
  #commitTypedValue(): void {
    const before = this.#controller.secondsOfDay;
    const typed = this.#field.value.trim();

    if (typed === '') {
      this.#controller.value = null;
      this.#commit({ emit: before !== null });
      return;
    }

    const parsed = parseHumanTime(typed, {
      dayPeriods: getDayPeriodNames(this.#effectiveLocale),
    });

    if (parsed === null) {
      this.#controller.setBadInput(true);
      this.#updateValidity();
      this.#internals.states.add('user-invalid');
      return;
    }

    this.#dirty = true;
    this.#controller.secondsOfDay = parsed;
    this.#commit({ emit: parsed !== before });
  }

  /** Single funnel: state -> form value -> validity -> DOM -> events. */
  #commit({ emit }: { emit: boolean }): void {
    const value = this.#controller.value;
    this.#internals.setFormValue(value ?? '');
    this.#updateValidity();
    this.#render();

    if (!emit) return;
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    this.dispatchEvent(new Event('change', { bubbles: true }));
    this.#status.textContent = describeTime(this.#controller.secondsOfDay, {
      locale: this.#effectiveLocale,
      hourCycle: this.hourCycle,
      withSeconds: this.seconds,
    });
  }

  #updateValidity(): void {
    const { badInput, valueMissing, rangeUnderflow, rangeOverflow } =
      this.#controller.validity;

    if (badInput) {
      this.#internals.setValidity(
        { badInput: true },
        'Enter a valid time, for example 9:30 AM.',
        this.#field
      );
    } else if (valueMissing) {
      this.#internals.setValidity(
        { valueMissing: true },
        'Please choose a time.',
        this.#field
      );
    } else if (rangeUnderflow) {
      this.#internals.setValidity(
        { rangeUnderflow: true },
        `Choose a time no earlier than ${this.min}.`,
        this.#field
      );
    } else if (rangeOverflow) {
      this.#internals.setValidity(
        { rangeOverflow: true },
        `Choose a time no later than ${this.max}.`,
        this.#field
      );
    } else {
      this.#internals.setValidity({});
    }

    if (this.#internals.validity.valid) {
      this.#internals.states.delete('user-invalid');
    } else if (this.#dirty) {
      this.#internals.states.add('user-invalid');
    }
    this.#field.setAttribute(
      'aria-invalid',
      String(!this.#internals.validity.valid)
    );
  }

  #announceField(field: TimeField): void {
    const seconds = this.#controller.secondsOfDay;
    if (seconds === null) return;
    const spin = this.#spins.get(field);
    spin?.setAttribute(
      'aria-valuetext',
      describeField(seconds, field, this.hourCycle)
    );
  }

  #render(): void {
    const controller = this.#controller;
    const locale = this.#effectiveLocale;
    const twelveHour = is12HourCycle(controller.hourCycle);
    const seconds = controller.secondsOfDay;

    // `document.activeElement` retargets to the host whenever anything inside
    // the shadow root has focus, so comparing against `this` also matched while
    // a segment was focused and froze the field. Ask the shadow root instead.
    if (this.#root.activeElement !== this.#field) {
      this.#field.value =
        seconds === null
          ? ''
          : formatTime(seconds, {
              locale,
              hourCycle: controller.hourCycle,
              withSeconds: controller.withSeconds,
            });
    }
    this.#field.placeholder =
      this.getAttribute('placeholder') ?? (twelveHour ? 'hh:mm AM' : 'hh:mm');
    const explicitLabel = this.getAttribute('aria-label')?.trim();
    const labelText = [...this.labels]
      .map(label => label.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    const accessibleName = explicitLabel || labelText;
    if (accessibleName) this.#field.setAttribute('aria-label', accessibleName);
    else this.#field.removeAttribute('aria-label');
    this.#field.setAttribute('aria-invalid', String(!this.validity.valid));
    this.#field.setAttribute('aria-expanded', String(this.open));
    this.#field.setAttribute('aria-haspopup', 'dialog');

    const parts = controller.parts ?? { hours: 0, minutes: 0, seconds: 0 };
    const display: Record<TimeField, number> = {
      hours: controller.displayHours ?? (twelveHour ? 12 : 0),
      minutes: parts.minutes,
      seconds: parts.seconds,
    };

    for (const [field, spin] of this.#spins) {
      const { min, max } = FIELD_RANGE[field](controller.hourCycle);
      const isSecondsField = field === 'seconds';
      spin.hidden = isSecondsField && !controller.withSeconds;
      spin.textContent = String(display[field]).padStart(2, '0');
      spin.setAttribute('aria-label', field);
      spin.setAttribute('aria-valuemin', String(min));
      spin.setAttribute('aria-valuemax', String(max));
      spin.setAttribute('aria-valuenow', String(display[field]));
      spin.setAttribute(
        'aria-valuetext',
        seconds === null
          ? 'Empty'
          : describeField(seconds, field, controller.hourCycle)
      );
      spin.setAttribute('aria-disabled', String(this.#isInert));
    }

    for (const dots of this.#root.querySelectorAll<HTMLElement>(
      '.dots.seconds-only'
    )) {
      dots.hidden = !controller.withSeconds;
    }

    this.#meridiem.hidden = !twelveHour;
    this.#meridiem.setAttribute('aria-label', 'AM or PM');
    const names = twelveHour ? getDayPeriodNames(locale) : { am: '', pm: '' };
    for (const [period, button] of this.#periods) {
      button.textContent = names[period];
      button.setAttribute(
        'aria-checked',
        String(controller.meridiem === period)
      );
      button.tabIndex = controller.meridiem === period ? 0 : -1;
      button.disabled = this.#isInert;
    }
  }
}

let baseRegistered = false;

/**
 * Registers the element, optionally under a custom tag name. Safe to call more
 * than once. Importing `picktime/element` registers nothing, so this is the
 * opt-in path; importing `picktime` calls it for you.
 *
 * A constructor can only back a single tag name in a registry, so any name
 * after the first gets a fresh subclass. That keeps a second registration from
 * throwing NotSupportedError when the package entry has already claimed
 * `pick-time`.
 */
export const definePickTime = (tagName = 'pick-time'): void => {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    baseRegistered ? class extends PickTimeElement {} : PickTimeElement
  );
  baseRegistered = true;
};
