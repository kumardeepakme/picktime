import '../scss/index.scss';

export default class PickTime {
  _defaults = {
    animation: 'drop',
    clock: 12,
    displayTime: { hour: 12, minute: 0, meridiem: 'am' },
    format: 'hh:mm A',
    input: '',
    margin: { top: 5, left: 0 },
    minuteSteps: 1,
    onKeys: true,
    onWheel: true,
    theme: 'light',
  };

  static pickers = 0;

  constructor(element, options) {
    this._element = element;
    this._options = options;

    // # TERMINATE IF INVALID ELEMENT
    if (!this._element || !this._element.nodeType === 1)
      return this._error('"element" not found or invalid');

    // # CHECK IF ELEMENT IS NOT INPUT
    if (
      !this._isInput(this._element) &&
      (this._options.input === '' || !this._isInput(this._options.input))
    )
      return this._error('element is not an input type, specify alternate with "input"');

    // # CHECK OPTIONS & VALIDATE
    // 1) If options & object
    if (this._options && !this._isObject(this._options))
      return this._error('"options" accept an object');

    // 2) Merge options
    this._options = { ...this._defaults, ...this._options };

    // 3) Validate options
    this._validateOptions();

    // # COUNT PICKTIME INSTANCES
    this.pickers = ++PickTime.pickers;

    // # SET ELEMENT READONLY
    !this._isInput(this._element) && this._isInput(this._options.input)
      ? this._options.input.setAttribute('readonly', '')
      : this._element.setAttribute('readonly', '');

    // # CREATE PICKER ELEMENT
    // 1) Set top & left
    let top =
      window.pageYOffset +
      this._element.getBoundingClientRect().top +
      this._element.offsetHeight +
      this._options.margin.top;
    let left =
      window.pageXOffset + this._element.getBoundingClientRect().left + this._options.margin.left;

    // 2) Picker div
    this.picker = document.createElement('div');
    this.picker.classList.add(
      'picktime',
      `picktime--${this._options.theme}`,
      `picktime--animation-${this._options.animation}`,
      `picktime--clock-${this._options.clock}`
    );
    this.picker.setAttribute('tabindex', '-1');
    this.picker.style.top = `${Math.ceil(top)}px`;
    this.picker.style.left = `${Math.ceil(left)}px`;
    this.picker.innerHTML = this._template('digital', this.pickers + Date.now());

    // 3) Append picker
    document.querySelector('body').appendChild(this.picker);

    // # POSITION PICKER ONRESIZE
    window.addEventListener('resize', () => {
      this._updatePickerPosition(
        window.pageYOffset +
          this._element.getBoundingClientRect().top +
          this._element.offsetHeight +
          this._options.margin.top,
        window.pageXOffset + this._element.getBoundingClientRect().left + this._options.margin.left
      );
    });

    // # ACTIVATE & DEACTIVATE PICKER
    // 1) Show
    this._element.addEventListener('focus', () => {
      this.picker.classList.add('picktime--active');
      this.picker.focus();
    });

    // 2) Hide
    // -> onBlur
    this._element.addEventListener('blur', e => {
      if (e.relatedTarget && !e.relatedTarget.className.startsWith('picktime'))
        this.picker.classList.remove('picktime--active');
    });
    // -> onClick
    document.addEventListener('mousedown', e => {
      if (
        e.target !== this._element &&
        e.target !== this.picker &&
        !e.target.className.startsWith('picktime')
      )
        this.picker.classList.remove('picktime--active');
    });

    // # TIME FORMATION
    this._hour = this._options.displayTime.hour || 12;
    if (this._options.clock === 24) {
      this._hour =
        this._convertTo24(this._options.displayTime.hour, this._options.displayTime.meridiem) || 0;
    }
    this._minute = this._options.displayTime.minute || 0;
    this._meridiem = this._options.displayTime.meridiem || 'am';

    // 1) Picker Inputs
    this.inputHour = this.picker.querySelector('input[name="pickerHour"]');
    this.inputMinute = this.picker.querySelector('input[name="pickerMinute"]');
    this.radioMeridiem = this.picker.querySelectorAll('#pickerMeridiem');

    this.inputHour.value = ('0' + this._hour).slice(-2);
    this.inputMinute.value = ('0' + this._minute).slice(-2);
    this.radioMeridiem.value = this._meridiem;
    this._inputDataset(this._hour, this._minute);

    [this.inputHour, this.inputMinute].forEach(input => {
      // 2) Allow onlyNumbers
      input.onkeypress = e => {
        if (
          e.key !== '1' &&
          e.key !== '2' &&
          e.key !== '3' &&
          e.key !== '4' &&
          e.key !== '5' &&
          e.key !== '6' &&
          e.key !== '7' &&
          e.key !== '8' &&
          e.key !== '9' &&
          e.key !== '0'
        ) {
          return false;
        }
      };

      // 3) onInput
      input.addEventListener('input', () => {
        switch (input.name) {
          case 'pickerHour':
            setTimeout(() => {
              if (!Number.isInteger(input.value * 1)) input.value = 0;

              if (this._options.clock === 12) {
                if (input.value * 1 > 12) input.value = 12;
              } else {
                if (input.value * 1 > 24) input.value = 24;
              }

              this.inputHour.value = input.value;
              this._inputDataset(this.inputHour.value, this.inputMinute.value);
              !this._isInput(this._element) && this._isInput(this._options.input)
                ? this._dispatchChangeEvent(this._options.input)
                : this._dispatchChangeEvent(this._element);
            }, 0);
            break;

          case 'pickerMinute':
            setTimeout(() => {
              if (!Number.isInteger(input.value * 1)) input.value = 0;

              if (input.value * 1 > 59) input.value = 0;

              this.inputMinute.value = input.value;
              this._inputDataset(this.inputHour.value, this.inputMinute.value);
              !this._isInput(this._element) && this._isInput(this._options.input)
                ? this._dispatchChangeEvent(this._options.input)
                : this._dispatchChangeEvent(this._element);
            }, 0);
            break;
        }
      });

      // 4) onWheel
      if (this._options.onWheel === true)
        input.addEventListener('wheel', e => this._timeFormation(e, e.deltaY > 0, e.deltaY < 0));

      // 5) onKeys
      if (this._options.onKeys === true)
        input.addEventListener('keydown', e => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown')
            this._timeFormation(e, e.key === 'ArrowUp', e.key === 'ArrowDown');
        });
    });

    // 5) Meridiem onClick
    this.radioMeridiem.forEach(radio => {
      if (radio.value === this._meridiem) radio.setAttribute('checked', '');

      radio.addEventListener('click', () => {
        if (radio.checked) this.radioMeridiem.value = radio.value;
        !this._isInput(this._element) && this._isInput(this._options.input)
          ? this._dispatchChangeEvent(this._options.input)
          : this._dispatchChangeEvent(this._element);
        this.picker.classList.remove('picktime--active');
      });

      // On Enter/SpaceBar
      radio.parentNode.addEventListener('keyup', e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();

          e.target.children[0].checked = true;

          this.radioMeridiem.value = e.target.children[0].value;
          !this._isInput(this._element) && this._isInput(this._options.input)
            ? this._dispatchChangeEvent(this._options.input)
            : this._dispatchChangeEvent(this._element);
          this.picker.classList.remove('picktime--active');
        }
      });
    });
  }

  // * Error
  _error(message) {
    console.error(Error(message));
  }

  // * isInput
  _isInput(el) {
    return el.nodeType === 1 && el.nodeName === 'INPUT';
  }

  // * isObject
  _isObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
  }

  // * Input Dataset
  _inputDataset(hour, minute) {
    this.inputHour.dataset.value = hour;
    this.inputMinute.dataset.value = minute;
  }

  // * Update top & bottom
  _updatePickerPosition(top, left) {
    this.picker.style.top = `${Math.ceil(top)}px`;
    this.picker.style.left = `${Math.ceil(left)}px`;
  }

  // * Validate Options
  _validateOptions() {
    // -> animation
    if (this._options.animation === '' || typeof this._options.animation !== 'string')
      return this._error('invalid "animation" value');

    // -> onKeys & onWheel
    [this._options.onKeys, this._options.onWheel].forEach(option => {
      if (option !== true && option !== false)
        return option === this._options.onKeys
          ? this._error('invalid "onKeys" value')
          : this._error('invalid "onWheel" value');
    });

    // -> displayTime
    if (
      Object.keys(this._options.displayTime).length > 0 &&
      this._isObject(this._options.displayTime)
    ) {
      if (this._options.displayTime.hour) {
        if (this._options.displayTime.hour < 0 || this._options.displayTime.hour > 12)
          throw new RangeError('invalid "displayTime.hour" value');
      } else {
        this._options.displayTime.hour = 12;
      }

      if (this._options.displayTime.minute) {
        if (this._options.displayTime.minute < 0 || this._options.displayTime.minute > 59)
          throw new RangeError('invalid "displayTime.minute" value');
      } else {
        this._options.displayTime.minute = 0;
      }

      if (this._options.displayTime.meridiem) {
        if (
          this._options.displayTime.meridiem !== '' &&
          this._options.displayTime.meridiem !== 'am' &&
          this._options.displayTime.meridiem !== 'pm'
        )
          return this._error('invalid "displayTime.meridiem" value');
      } else {
        this._options.displayTime.meridiem = 'am';
      }
    } else {
      this._options.displayTime = { hour: 12, minute: 0, meridiem: 'am' };
    }

    // -> clock
    if (this._options.clock !== 12 && this._options.clock !== 24)
      return this._error('invalid "clock" value');

    // -> format
    if (
      this._options.format !== '' &&
      !/^(h{1,2}):(m{1,2})\s([a|A]{1})$/g.test(this._options.format)
    )
      return this._error('invalid "format" value');

    // -> margin
    if (Object.keys(this._options.margin).length > 0 && this._isObject(this._options.margin)) {
      if (this._options.margin.top) {
        if (!Number.isInteger(this._options.margin.top * 1))
          return this._error('invalid "margin.top" value');
      } else {
        this._options.margin.top = 5;
      }

      if (this._options.margin.left) {
        if (!Number.isInteger(this._options.margin.left * 1))
          return this._error('invalid "margin.left" value');
      } else {
        this._options.margin.left = 0;
      }
    } else {
      this._options.margin = { top: 5, left: 0 };
    }

    // -> minuteSteps
    if (this._options.minuteSteps < 1 || this._options.minuteSteps > 60)
      throw new RangeError('invalid "minuteSteps" value');

    // -> theme
    if (this._options.theme === '' || typeof this._options.theme !== 'string')
      return this._error('invalid "theme" value');
  }

  // * Convert 12h to 24h
  _convertTo24(hour, meridiem) {
    let hour24;
    meridiem === 'pm' ? (hour24 = hour + 12) : (hour24 = hour);
    if (hour === 12 && meridiem === 'am') hour24 = 0;
    if (hour === 12 && meridiem === 'pm') hour24 = 12;
    if (hour === 12 && meridiem === '') hour24 = 24;
    return hour24;
  }

  // * Format Time
  _formatTime(hour, minute, meridiem, format) {
    if (/^A$/.test(format.split(' ')[1])) meridiem = meridiem.toUpperCase();
    format
      .split(' ')[0]
      .split(':')
      .forEach(handle => {
        if (/^h{2}$/.test(handle)) hour = ('0' + hour).slice(-2);
        if (/^m{2}$/.test(handle)) minute = ('0' + minute).slice(-2);
      });
    return this._options.clock === 24 ? `${hour}:${minute}` : `${hour}:${minute} ${meridiem}`;
  }

  // * Dispatch Change Event
  _dispatchChangeEvent(el) {
    el.value = this._formatTime(
      this.inputHour.dataset.value,
      this.inputMinute.dataset.value,
      this.radioMeridiem.value,
      this._options.format
    );
    el.dispatchEvent(new Event('change'), { bubbles: true });
  }

  // * onKeys & onWheel
  _timeFormation(event, conInc, conDec) {
    if (conInc || conDec) event.preventDefault();
    event.target.focus();

    switch (event.target.name) {
      case 'pickerHour':
        if (conInc) this._hour += 1;
        if (conDec) this._hour -= 1;

        if (this._options.clock === 12) {
          if (this._hour === 0) this._hour = 12;
          if (this._hour > 12) this._hour = 1;
        } else {
          if (this._hour < 0) this._hour = 24;
          if (this._hour > 24) this._hour = 0;
        }

        this.inputHour.value = ('0' + this._hour).slice(-2);
        this._inputDataset(this._hour, this._minute);
        !this._isInput(this._element) && this._isInput(this._options.input)
          ? this._dispatchChangeEvent(this._options.input)
          : this._dispatchChangeEvent(this._element);
        break;

      case 'pickerMinute':
        if (conInc) this._minute += this._options.minuteSteps;
        if (conDec) this._minute -= this._options.minuteSteps;

        if (this._minute < 0) {
          this._minute = 60 - this._options.minuteSteps * 1;

          if (this._options.clock === 12) {
            if (this._hour === 1) this._hour = 12;
            this._hour -= 1;
          } else {
            if (this._hour === 0) this._hour = 24;
            this._hour -= 1;
          }
        }
        if (this._minute > 60 - this._options.minuteSteps * 1) {
          this._minute = 0;

          if (this._options.clock === 12) {
            if (this._hour === 12) this._hour = 0;
            this._hour += 1;
          } else {
            if (this._hour === 24) this._hour = 0;
            this._hour += 1;
          }
        }
        if (this._minute > 0) {
          if (this._hour === 24) this._hour = 0;
        }

        this.inputMinute.value = ('0' + this._minute).slice(-2);
        this.inputHour.value = ('0' + this._hour).slice(-2);
        this._inputDataset(this._hour, this._minute);
        !this._isInput(this._element) && this._isInput(this._options.input)
          ? this._dispatchChangeEvent(this._options.input)
          : this._dispatchChangeEvent(this._element);
        break;
    }
  }

  // * Picker Template
  _template(clock, instance) {
    let html;
    switch (clock) {
      case 'digital':
      default:
        html = `<div class="picktime__body"><div class="picktime__box"><input class="picktime__box--input" type="text" name="pickerHour" maxlength="2" tabindex="1"></div><div class="picktime__box"><div class="picktime__box--dots"><span class="picktime__box--dots-dot"></span><span class="picktime__box--dots-dot"></span></div></div><div class="picktime__box"><input class="picktime__box--input" type="text" name="pickerMinute" maxlength="2" tabindex="2"></div><div class="picktime__meridiem"><label class="picktime__meridiem--label" tabindex="3"><input id="pickerMeridiem" class="picktime__meridiem--radio" type="radio" name="pickerMeridiem${instance}" value="am"><span class="picktime__meridiem--span">AM</span></label><label class="picktime__meridiem--label" tabindex="4"><input id="pickerMeridiem" class="picktime__meridiem--radio" type="radio" name="pickerMeridiem${instance}" value="pm"><span class="picktime__meridiem--span">PM</span></label></div></div>`;
        break;
    }
    return html;
  }
}
