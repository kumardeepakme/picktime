import { PickerOptions } from './utils/types';
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
    offset: { left: 0, top: 3 },
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

    this.#showHidePicker(this.#inputEl, this.#PickerTemplate.picker);

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

  #showHidePicker(inputEl: HTMLInputElement, picker: HTMLDivElement): void {
    // Show
    inputEl.addEventListener('focus', () => {
      picker.classList.add('picktime--active');
      this.#PickerTemplate.position();
    });

    // Hide
    document.addEventListener('mousedown', (e: MouseEvent) => {
      if (
        e.target !== inputEl &&
        e.target !== picker &&
        !(e.target as HTMLElement).className.startsWith('picktime')
      )
        picker.classList.remove('picktime--active');
    });
  }

  // Getters
  get time() {
    return this.#time.time;
  }
}
