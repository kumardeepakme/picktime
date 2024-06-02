import { PickerOptions, Time, TimeOutput } from './utils/types';
import { validateInputEl, validatePickerOptions } from './utils/validation';
import { PickerTemplate } from './PickerTemplate';
import { TimeFormatter } from './TimeFormatter';

export class PickTime {
  #inputEl: HTMLInputElement;
  #options?: PickerOptions;
  #defaultOptions: PickerOptions = {
    animation: 'drop',
    arrow: true,
    clock: 12,
    minuteSteps: 1,
    offset: { left: 0, top: 2 },
    theme: 'light',
    time: { hours: 12, minutes: 0, meridiem: 'am' },
    upDownKeys: true,
    wheelSpin: true,
  };
  static pickers: number = 0;
  #PickerTemplate!: PickerTemplate;
  #time: TimeFormatter;

  constructor(inputEl: HTMLInputElement, options: PickerOptions) {
    this.#inputEl = inputEl;
    validateInputEl(this.#inputEl);

    this.#options = options
      ? validatePickerOptions(options)
        ? { ...this.#defaultOptions, ...options }
        : this.#defaultOptions
      : this.#defaultOptions;

    PickTime.pickers++;

    this.#loadTemplate(this.#inputEl, this.#options, PickTime.pickers);

    this.#togglePicker();

    this.#time = new TimeFormatter(
      this.#inputEl,
      this.#options,
      this.#PickerTemplate.picker,
      PickTime.pickers
    );
  }

  #loadTemplate(
    inputEL: HTMLInputElement,
    options: PickerOptions,
    id: number
  ): void {
    const pickerTemplate = new PickerTemplate(inputEL, options, id);
    this.#PickerTemplate = pickerTemplate;
  }

  #handleShowPickerOnFocus = () => {
    this.#PickerTemplate.picker.classList.add('picktime--active');

    this.#PickerTemplate.position();

    (
      this.#PickerTemplate.picker.querySelector(
        'input[name=pickerHours]'
      ) as HTMLInputElement
    ).focus({ preventScroll: true });
  };

  #handleHidePickerOnMouseDown = (e: MouseEvent) => {
    if (
      e.target !== this.#inputEl &&
      e.target !== this.#PickerTemplate.picker &&
      !(e.target as HTMLElement).className.startsWith('picktime')
    )
      this.#PickerTemplate.picker.classList.remove('picktime--active');
  };

  #togglePicker(): void {
    // Show
    this.#inputEl.addEventListener('focus', this.#handleShowPickerOnFocus);

    // Hide OnMouseDown
    document.addEventListener('mousedown', this.#handleHidePickerOnMouseDown);
  }

  // * METHODS
  // SetTime
  setTime({ hours, minutes, meridiem }: Time): void {
    if (hours && !Number.isInteger(hours))
      throw new Error('setTime() "hours" must be an integer');
    if (hours && (hours < 0 || hours > 23))
      throw new RangeError(
        'setTime() "hours" property must range between 1-23'
      );

    if (minutes && !Number.isInteger(minutes))
      throw new Error('setTime() "minutes" must be an integer');
    if (minutes && (minutes < 0 || minutes > 59))
      throw new RangeError(
        'setTime() "minutes" property must range between 1-59'
      );

    if (meridiem && typeof meridiem !== 'string')
      throw new Error('setTime() "meridiem" must be a string');
    if (meridiem) {
      if (meridiem.toLowerCase() !== 'am' && meridiem.toLowerCase() !== 'pm')
        throw new Error('setTime() "meridiem" value must be am/pm');
    }

    this.#time.setTime({ hours, minutes, meridiem });
  }

  // Disable
  disable(): void {
    this.#PickerTemplate.picker
      .querySelectorAll('input[type=text]')
      .forEach(input => {
        input.setAttribute('disabled', '');

        (input as HTMLInputElement).removeEventListener(
          'wheel',
          this.#time.handleWheel
        );

        (input as HTMLInputElement).style.pointerEvents = 'none';
      });

    this.#PickerTemplate.picker
      .querySelectorAll(`input[type=radio]`)
      .forEach(radio => {
        // onClick
        (radio as HTMLInputElement).removeEventListener(
          'click',
          this.#time.handleMeridiemClick
        );

        // onSpaceBar
        (radio.parentElement as HTMLElement).removeEventListener(
          'keydown',
          this.#time.handleMeridiemKeyDown
        );

        (radio.parentElement as HTMLInputElement).style.pointerEvents = 'none';
        (radio.parentElement as HTMLInputElement).setAttribute(
          'tabindex',
          '-1'
        );
      });
  }

  // Enable
  enable(): void {
    this.#PickerTemplate.picker
      .querySelectorAll('input[type=text]')
      .forEach(input => {
        input.removeAttribute('disabled');

        (input as HTMLInputElement).addEventListener(
          'wheel',
          this.#time.handleWheel
        );

        (input as HTMLInputElement).style.pointerEvents = 'auto';
      });

    this.#PickerTemplate.picker
      .querySelectorAll(`input[type=radio]`)
      .forEach(radio => {
        // onClick
        (radio as HTMLInputElement).addEventListener(
          'click',
          this.#time.handleMeridiemClick
        );

        // onSpaceBar
        (radio.parentElement as HTMLElement).addEventListener(
          'keydown',
          this.#time.handleMeridiemKeyDown
        );

        (radio.parentElement as HTMLInputElement).style.pointerEvents = 'auto';
        (radio.parentElement as HTMLInputElement).setAttribute(
          'tabindex',
          (radio.parentElement as HTMLInputElement).dataset.tabindex!
        );
      });
  }

  // Destroy
  destroy(): void {
    PickTime.pickers--;

    this.#options = this.#defaultOptions;

    this.#PickerTemplate.picker.remove();

    this.#inputEl.value = '';
    this.#inputEl.removeAttribute('readonly');
    this.#inputEl.removeEventListener('focus', this.#handleShowPickerOnFocus);

    document.removeEventListener(
      'mousedown',
      this.#handleHidePickerOnMouseDown
    );
  }

  // * GETTERS
  // GetTime
  get getTime(): TimeOutput {
    return this.#time.time;
  }
}
