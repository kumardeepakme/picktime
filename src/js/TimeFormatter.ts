import { PickerOptions, Time, TimeOutput } from './utils/types';

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
  #time!: TimeOutput;

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
      // onClick
      radio.addEventListener('click', this.handleMeridiemClick);

      // onSpaceBar
      (radio.parentElement as HTMLElement).addEventListener(
        'keydown',
        this.handleMeridiemKeyDown
      );
    });

    this.setTime({
      hours: this.hours,
      minutes: this.minutes,
      meridiem: this.meridiem,
    });
    this.#restrictInput();
    this.#wheelSpin();
  }

  setTime({ hours, minutes, meridiem }: Time) {
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
          (meridiem as string).toLowerCase() !== 'am' &&
          (meridiem as string).toLowerCase() !== 'pm'
            ? this.meridiem
            : (meridiem as string).toLowerCase();
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
        if (this.isUpDownKeys) {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();

            input.focus();

            input.name === 'pickerHours'
              ? this.#handleHours(e.key === 'ArrowUp', e.key === 'ArrowDown')
              : this.#handleMinutes(e.key === 'ArrowUp', e.key === 'ArrowDown');
          }
        }
      })
    );
  }

  handleMeridiemClick = (e: MouseEvent) => {
    this.meridiem = (e.target as HTMLInputElement).value.toLowerCase();
    this.setTime({
      hours: this.hours,
      minutes: this.minutes,
      meridiem: this.meridiem,
    });
  };

  handleMeridiemKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') e.preventDefault();
    if (e.code === 'Space' || e.key === ' ') {
      this.meridiem = (
        (e.target as HTMLInputElement).children[0] as HTMLInputElement
      ).value.toLowerCase();
      this.setTime({
        hours: this.hours,
        minutes: this.minutes,
        meridiem: this.meridiem,
      });
    }
  };

  handleWheel = (e: WheelEvent) => {
    if (!e.deltaY) return;

    e.preventDefault();

    (e.target as HTMLInputElement).focus();

    (e.target as HTMLInputElement).name === 'pickerHours'
      ? this.#handleHours(e.deltaY > 0, e.deltaY < 0)
      : this.#handleMinutes(e.deltaY > 0, e.deltaY < 0);
  };

  #wheelSpin(): void {
    if (!this.isWheelSpin) return;

    [this.hoursInputEl, this.minutesInputEl].forEach(input =>
      input.addEventListener('wheel', this.handleWheel)
    );
  }

  #handleHours(plus: boolean, minus: boolean): void {
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

    this.setTime({
      hours: this.hours!,
      minutes: this.minutes!,
      meridiem: this.meridiem!,
    });
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

    this.setTime({
      hours: this.hours!,
      minutes: this.minutes!,
      meridiem: this.meridiem!,
    });
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

  // * GETTERS
  get time() {
    return this.#time;
  }
}
