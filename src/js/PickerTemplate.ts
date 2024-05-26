import {
  computePosition,
  autoUpdate,
  flip,
  shift,
  offset,
  arrow,
  Coords,
} from '@floating-ui/dom';

import { PickerOptions } from './utils/types';

export class PickerTemplate {
  #inputEl: HTMLInputElement;
  #options: PickerOptions;
  #id: number;
  #picker!: HTMLDivElement;

  constructor(inputEl: HTMLInputElement, options: PickerOptions, id: number) {
    this.#inputEl = inputEl;
    this.#options = options;
    this.#id = id;

    this.#createPicker(this.#options, this.#id);
  }

  #createPicker(options: PickerOptions, id: number) {
    // Picker DivElement
    const picker = document.createElement('div');
    picker.setAttribute('tabindex', '-1');
    picker.dataset.picker = `picktime${id}`;
    picker.classList.add(
      'picktime',
      `picktime--${options.theme}`,
      `picktime--animation-${options.animation}`,
      `picktime--clock-${options.clock}`
    );
    picker.innerHTML = `<div class="picktime--body">
      <input class="picktime--input" type="text" name="pickerHours" maxlength="2" tabindex="1" readonly>
      <div class="picktime--dots"></div>
      <input class="picktime--input" type="text" name="pickerMinutes" maxlength="2" tabindex="2" readonly>
      ${this.#showMeridiem ? this.#meridiem() : ''}
    </div>`;

    const arrowEl: HTMLElement = this.#arrow();
    if (this.#showArrow) picker.appendChild(arrowEl);

    document.body.appendChild(picker);

    this.#picker = picker;
  }

  position() {
    const left = this.#options.offset?.left || 0;
    const top = this.#options.offset?.top || 0;
    const arrowEl = <HTMLElement>this.#picker.querySelector('.picktime--arrow');

    autoUpdate(this.#inputEl, this.#picker, () => {
      if (arrowEl) {
        arrowEl.classList.remove(`picktime--arrow-top`);
        arrowEl.classList.remove(`picktime--arrow-bottom`);
      }

      computePosition(this.#inputEl, this.#picker, {
        placement: 'bottom-start',
        middleware: [
          offset({
            crossAxis: left,
            mainAxis: top,
          }),
          flip(),
          shift({ padding: 5 }),
          this.#showArrow && arrowEl && arrow({ element: arrowEl }),
        ],
      }).then(({ x, y, placement, middlewareData }) => {
        Object.assign(this.#picker.style, {
          left: `${x}px`,
          top: `${y}px`,
        });

        // Arrow Placement
        if (this.#showArrow && arrowEl) {
          const { y: arrowY } = middlewareData.arrow as Partial<Coords>;

          const arrowPlacement = placement.split('-')[0];
          const arrowSide = {
            top: 'bottom',
            right: 'left',
            bottom: 'top',
            left: 'right',
          }[arrowPlacement] as string;

          if (arrowEl) arrowEl.classList.add(`picktime--arrow-${arrowSide}`);

          Object.assign(arrowEl.style, {
            left: '15px',
            top: arrowY != null ? `${arrowY}px` : '',
            right: '',
            bottom: '',
            [arrowSide]: '-6px',
          });
        }
      });
    });
  }

  #meridiem() {
    return `<div class="picktime__meridiem">
      <label class="picktime__meridiem--switch" tabindex="3">
        <input class="picktime__meridiem--radio" type="radio" name="pickerMeridiem${this.#id}" value="am">
        <div class="picktime__meridiem--label"><span>AM</span></div>
      </label>
      <label class="picktime__meridiem--switch" tabindex="4">
        <input class="picktime__meridiem--radio" type="radio" name="pickerMeridiem${this.#id}" value="pm">
        <div class="picktime__meridiem--label"><span>PM</span></div>
      </label>
    </div>`;
  }

  #arrow(): HTMLElement {
    const arrow = document.createElement('div');
    arrow.className = 'picktime--arrow';
    arrow.innerHTML = `<svg width="16" height="6" xmlns="http://www.w3.org/2000/svg"><path d="M0 6s1.796-.013 4.67-3.615C5.851.9 6.93.006 8 0s2.148.887 3.343 2.385C14.233 6.005 16 6 16 6z"/></svg><svg width="16" height="6" xmlns="http://www.w3.org/2000/svg"><path d="M0 6s1.796-.013 4.67-3.615C5.851.9 6.93.006 8 0s2.148.887 3.343 2.385C14.233 6.005 16 6 16 6z"/></svg>`;
    return arrow;
  }

  get #showMeridiem(): boolean {
    return this.#options.clock === 12;
  }

  get #showArrow(): boolean {
    return this.#options.arrow!;
  }

  get picker(): HTMLDivElement {
    return this.#picker;
  }
}
