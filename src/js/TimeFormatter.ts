import { PickerOptions } from './utils/types';

export class TimeFormatter {
  inputEl: HTMLInputElement;
  clock: number;
  hours: number;
  minutes: number;
  meridiem: string | null;
  minuteSteps: number;
  isUpDownKeys: boolean;
  isWheelSpin: boolean;
  #picker: HTMLDivElement;
  #id: number;
  hoursInputEl: HTMLInputElement;
  minutesInputEl: HTMLInputElement;
  meridiemInputEls: NodeListOf<HTMLInputElement>;
  #time!: {
    displayTime: string;
    meridiem: string | null;
    time: string;
    utcOffset: string;
  };

  constructor(
    inputEl: HTMLInputElement,
    options: PickerOptions,
    picker: HTMLDivElement,
    id: number
  ) {
    this.inputEl = inputEl;
    this.clock = options.clock || 12;
    this.hours = options.time!.hours || 12;
    this.minutes = options.time!.minutes || 0;
    this.meridiem = options.time!.meridiem || 'am';
    this.minuteSteps = options.minuteSteps || 1;
    this.isUpDownKeys = options.upDownKeys || false;
    this.isWheelSpin = options.wheelSpin || false;
    this.#picker = picker;
    this.#id = id;

    this.hoursInputEl = this.#picker.querySelector('input[name=pickerHours]')!;
    this.minutesInputEl = this.#picker.querySelector(
      'input[name=pickerMinutes]'
    )!;
    this.meridiemInputEls = this.#picker.querySelectorAll(
      `input[name=pickerMeridiem${this.#id}]`
    )!;
    this.meridiemInputEls.forEach(radio => {
      radio.addEventListener('click', () => {
        this.meridiem = radio.value.toLowerCase();
        this.#setTime(this.hours, this.minutes, this.meridiem);
      });
    });

    this.#setTime(this.hours, this.minutes, this.meridiem);
    this.#restrictInput();
    this.#wheelSpin();
  }

  #setTime(hours: number, minutes: number, meridiem: string) {
    // Validating Hours, Minutes & Meridiem
    this.hours = Math.abs(hours);
    this.minutes = Math.abs(minutes);
    switch (this.clock) {
      case 24:
        if (this.hours > 23) this.hours = 23;
        if (this.minutes === 60) this.minutes = 0;
        this.meridiem = null;
        break;

      default:
        if (this.hours > 12) this.hours = 12;
        if (this.minutes === 60) this.minutes = 0;
        this.meridiem =
          meridiem.toLowerCase() !== 'am' && meridiem.toLowerCase() !== 'pm'
            ? 'am'
            : meridiem.toLowerCase();
        break;
    }

    // Updating PickerInputEls Value
    this.hoursInputEl.value = String(this.hours).padStart(2, '0');
    this.minutesInputEl.value = String(this.minutes).padStart(2, '0');
    if (this.clock === 12) {
      this.meridiemInputEls.forEach(radio => {
        if (radio.value.toLowerCase() === this.meridiem!.toLowerCase())
          radio.checked = true;
      });
    }

    // Setting InputEl Value
    const displayTime: string =
      this.clock === 12
        ? `${String(this.hours).padStart(2, '0')}:${String(this.minutes).padStart(2, '0')} ${this.meridiem!.toUpperCase()}`
        : `${String(this.hours).padStart(2, '0')}:${String(this.minutes).padStart(2, '0')}`;
    this.inputEl.value = displayTime;

    // Updating Return Time
    this.#time = {
      displayTime,
      meridiem: this.clock === 12 ? this.meridiem : null,
      time: `${String(this.hours).padStart(2, '0')}:${String(this.minutes).padStart(2, '0')}`,
      utcOffset: this.#utcOffset(),
    };

    // Dispatching Change Event
    this.inputEl.dispatchEvent(
      new Event('change', { bubbles: true, cancelable: true })
    );
  }

  #restrictInput() {
    [this.hoursInputEl, this.minutesInputEl].forEach(input =>
      input.addEventListener('keydown', e => {
        // Only TAB Key
        if (e.key !== 'Tab') e.preventDefault();

        // Up&Down Keys
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();

          input.focus();

          input.name === 'pickerHours'
            ? this.#handleHours(e.key === 'ArrowUp', e.key === 'ArrowDown')
            : this.#handleMinutes(e.key === 'ArrowUp', e.key === 'ArrowDown');
        }
      })
    );
  }

  #wheelSpin() {
    if (this.isWheelSpin) {
      [this.hoursInputEl, this.minutesInputEl].forEach(input =>
        input.addEventListener('wheel', e => {
          if (!e.deltaY) return;

          e.preventDefault();

          input.focus();

          input.name === 'pickerHours'
            ? this.#handleHours(e.deltaY > 0, e.deltaY < 0)
            : this.#handleMinutes(e.deltaY > 0, e.deltaY < 0);
        })
      );
    }
  }

  #handleHours(plus: boolean, minus: boolean) {
    if (plus) this.hours += 1;
    if (minus) this.hours -= 1;

    switch (this.clock) {
      case 24:
        if (this.hours < 0) this.hours = 23;
        if (this.hours > 23) this.hours = 0;
        break;

      default:
        if (this.hours === 0) this.hours = 12;
        if (this.hours > 12) this.hours = 1;
        break;
    }

    this.#setTime(this.hours, this.minutes, this.meridiem!);
  }

  #handleMinutes(plus: boolean, minus: boolean) {
    if (plus) this.minutes += this.minuteSteps;
    if (minus) this.minutes -= this.minuteSteps;

    if (this.minutes < 0) {
      this.minutes = 60 - this.minuteSteps;

      switch (this.clock) {
        case 24:
          if (this.hours === 0) this.hours = 24;
          this.hours -= 1;
          break;

        default:
          if (this.hours === 1) this.hours = 12;
          this.hours -= 1;
          break;
      }
    }
    if (this.minutes > 60 - this.minuteSteps) {
      this.minutes = 0;

      switch (this.clock) {
        case 24:
          if (this.hours === 23) this.hours = 0;
          this.hours += 1;
          break;

        default:
          if (this.hours === 12) this.hours = 0;
          this.hours += 1;
          break;
      }
    }

    this.#setTime(this.hours, this.minutes, this.meridiem!);
  }

  #utcOffset() {
    const now = new Date();

    const timezoneOffset = now.getTimezoneOffset();

    // TimezoneOffset Hours & Minutes
    const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
    const offsetMinutes = Math.abs(timezoneOffset) % 60;
    const sign = timezoneOffset <= 0 ? '+' : '-';

    // TimezoneOffset String
    const formattedOffset = `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;

    return formattedOffset;
  }

  get time() {
    return this.#time;
  }
}
