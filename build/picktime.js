"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class PickTime {
  constructor(element, options) {
    _defineProperty(this, "_defaults", {
      animation: 'drop',
      clock: 12,
      displayTime: {
        hour: 12,
        minute: 0,
        meridiem: 'am'
      },
      format: 'hh:mm A',
      margin: {
        top: 5,
        left: 0
      },
      minuteSteps: 1,
      onKeys: true,
      onWheel: true,
      theme: 'light'
    });

    this._element = element;
    this._options = options;
    if (!this._element || !(this._element.nodeType === 1 && this._element.nodeName === 'INPUT')) return this._error('"element" not found or invalid');
    if (this._options && !this._isObject(this._options)) return this._error('"options" accept an object');
    this._options = _objectSpread(_objectSpread({}, this._defaults), this._options);

    this._validateOptions();

    this.pickers = ++PickTime.pickers;

    this._element.setAttribute('readonly', '');

    var top = window.pageYOffset + this._element.getBoundingClientRect().top + this._element.offsetHeight + this._options.margin.top;

    var left = window.pageXOffset + this._element.getBoundingClientRect().left + this._options.margin.left;

    this.picker = document.createElement('div');
    this.picker.classList.add('picktime', "picktime--".concat(this._options.theme), "picktime--animation-".concat(this._options.animation), "picktime--clock-".concat(this._options.clock));
    this.picker.setAttribute('tabindex', '-1');
    this.picker.style.top = "".concat(Math.ceil(top), "px");
    this.picker.style.left = "".concat(Math.ceil(left), "px");
    this.picker.innerHTML = this._template('digital', this.pickers);
    document.querySelector('body').appendChild(this.picker);
    window.addEventListener('resize', () => {
      this._updatePickerPosition(window.pageYOffset + this._element.getBoundingClientRect().top + this._element.offsetHeight + this._options.margin.top, window.pageXOffset + this._element.getBoundingClientRect().left + this._options.margin.left);
    });

    this._element.addEventListener('focus', () => {
      this.picker.classList.add('picktime--active');
      this.picker.focus();
    });

    this._element.addEventListener('blur', e => {
      if (e.relatedTarget && !e.relatedTarget.className.startsWith('picktime')) this.picker.classList.remove('picktime--active');
    });

    document.addEventListener('mousedown', e => {
      if (e.target !== this._element && e.target !== this.picker && !e.target.className.startsWith('picktime')) this.picker.classList.remove('picktime--active');
    });
    this._hour = this._options.displayTime.hour || 12;

    if (this._options.clock === 24) {
      this._hour = this._convertTo24(this._options.displayTime.hour, this._options.displayTime.meridiem) || 0;
    }

    this._minute = this._options.displayTime.minute || 0;
    this._meridiem = this._options.displayTime.meridiem || 'am';
    this.inputHour = this.picker.querySelector('input[name="pickerHour"]');
    this.inputMinute = this.picker.querySelector('input[name="pickerMinute"]');
    this.radioMeridiem = this.picker.querySelectorAll('#pickerMeridiem');
    this.inputHour.value = ('0' + this._hour).slice(-2);
    this.inputMinute.value = ('0' + this._minute).slice(-2);
    this.radioMeridiem.value = this._meridiem;

    this._inputDataset(this._hour, this._minute);

    [this.inputHour, this.inputMinute].forEach(input => {
      input.onkeypress = e => {
        if (e.key !== '1' && e.key !== '2' && e.key !== '3' && e.key !== '4' && e.key !== '5' && e.key !== '6' && e.key !== '7' && e.key !== '8' && e.key !== '9' && e.key !== '0') {
          return false;
        }
      };

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

              this._dispatchChangeEvent(this._element);
            }, 0);
            break;

          case 'pickerMinute':
            setTimeout(() => {
              if (!Number.isInteger(input.value * 1)) input.value = 0;
              if (input.value * 1 > 59) input.value = 0;
              this.inputMinute.value = input.value;

              this._inputDataset(this.inputHour.value, this.inputMinute.value);

              this._dispatchChangeEvent(this._element);
            }, 0);
            break;
        }
      });
      if (this._options.onWheel === true) input.addEventListener('wheel', e => this._timeFormation(e, e.deltaY > 0, e.deltaY < 0));
      if (this._options.onKeys === true) input.addEventListener('keydown', e => this._timeFormation(e, e.key === 'ArrowUp', e.key === 'ArrowDown'));
    });
    this.radioMeridiem.forEach(radio => {
      if (radio.value === this._meridiem) radio.setAttribute('checked', '');
      radio.addEventListener('click', () => {
        if (radio.checked) this.radioMeridiem.value = radio.value;

        this._dispatchChangeEvent(this._element);

        this.picker.classList.remove('picktime--active');
      });
    });
  }

  _error(message) {
    console.error(Error(message));
  }

  _isObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
  }

  _inputDataset(hour, minute) {
    this.inputHour.dataset.value = hour;
    this.inputMinute.dataset.value = minute;
  }

  _updatePickerPosition(top, left) {
    this.picker.style.top = "".concat(Math.ceil(top), "px");
    this.picker.style.left = "".concat(Math.ceil(left), "px");
  }

  _validateOptions() {
    if (this._options.animation === '' || typeof this._options.animation !== 'string') return this._error('invalid "animation" value');
    [this._options.onKeys, this._options.onWheel].forEach(option => {
      if (option !== true && option !== false) return option === this._options.onKeys ? this._error('invalid "onKeys" value') : this._error('invalid "onWheel" value');
    });

    if (Object.keys(this._options.displayTime).length > 0 && this._isObject(this._options.displayTime)) {
      if (this._options.displayTime.hour) {
        if (this._options.displayTime.hour < 0 || this._options.displayTime.hour > 12) throw new RangeError('invalid "displayTime.hour" value');
      } else {
        this._options.displayTime.hour = 12;
      }

      if (this._options.displayTime.minute) {
        if (this._options.displayTime.minute < 0 || this._options.displayTime.minute > 59) throw new RangeError('invalid "displayTime.minute" value');
      } else {
        this._options.displayTime.minute = 0;
      }

      if (this._options.displayTime.meridiem) {
        if (this._options.displayTime.meridiem !== '' && this._options.displayTime.meridiem !== 'am' && this._options.displayTime.meridiem !== 'pm') return this._error('invalid "displayTime.meridiem" value');
      } else {
        this._options.displayTime.meridiem = 'am';
      }
    } else {
      this._options.displayTime = {
        hour: 12,
        minute: 0,
        meridiem: 'am'
      };
    }

    if (this._options.clock !== 12 && this._options.clock !== 24) return this._error('invalid "clock" value');
    if (this._options.format !== '' && !/^(h{1,2}):(m{1,2})\s([a|A]{1})$/g.test(this._options.format)) return this._error('invalid "format" value');

    if (Object.keys(this._options.margin).length > 0 && this._isObject(this._options.margin)) {
      if (this._options.margin.top) {
        if (!Number.isInteger(this._options.margin.top * 1)) return this._error('invalid "margin.top" value');
      } else {
        this._options.margin.top = 5;
      }

      if (this._options.margin.left) {
        if (!Number.isInteger(this._options.margin.left * 1)) return this._error('invalid "margin.left" value');
      } else {
        this._options.margin.left = 0;
      }
    } else {
      this._options.margin = {
        top: 5,
        left: 0
      };
    }

    if (this._options.minuteSteps < 1 || this._options.minuteSteps > 60) throw new RangeError('invalid "minuteSteps" value');
    if (this._options.theme === '' || typeof this._options.theme !== 'string') return this._error('invalid "theme" value');
  }

  _convertTo24(hour, meridiem) {
    var hour24;
    meridiem === 'pm' ? hour24 = hour + 12 : hour24 = hour;
    if (hour === 12 && meridiem === 'am') hour24 = 0;
    if (hour === 12 && meridiem === 'pm') hour24 = 12;
    if (hour === 12 && meridiem === '') hour24 = 24;
    return hour24;
  }

  _formatTime(hour, minute, meridiem, format) {
    if (/^A$/.test(format.split(' ')[1])) meridiem = meridiem.toUpperCase();
    format.split(' ')[0].split(':').forEach(handle => {
      if (/^h{2}$/.test(handle)) hour = ('0' + hour).slice(-2);
      if (/^m{2}$/.test(handle)) minute = ('0' + minute).slice(-2);
    });
    return this._options.clock === 24 ? "".concat(hour, ":").concat(minute) : "".concat(hour, ":").concat(minute, " ").concat(meridiem);
  }

  _dispatchChangeEvent(el) {
    el.value = this._formatTime(this.inputHour.dataset.value, this.inputMinute.dataset.value, this.radioMeridiem.value, this._options.format);
    el.dispatchEvent(new Event('change'), {
      bubbles: true
    });
  }

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

        this._dispatchChangeEvent(this._element);

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

        this._dispatchChangeEvent(this._element);

        break;
    }
  }

  _template(clock, instance) {
    var html;

    switch (clock) {
      case 'digital':
      default:
        html = "<div class=\"picktime__body\"><div class=\"picktime__box\"><input class=\"picktime__box--input\" type=\"text\" name=\"pickerHour\" maxlength=\"2\" tabindex=\"1\"></div><div class=\"picktime__box\"><div class=\"picktime__box--dots\"><span class=\"picktime__box--dots-dot\"></span><span class=\"picktime__box--dots-dot\"></span></div></div><div class=\"picktime__box\"><input class=\"picktime__box--input\" type=\"text\" name=\"pickerMinute\" maxlength=\"2\" tabindex=\"2\"></div><div class=\"picktime__meridiem\"><label class=\"picktime__meridiem--label\" tabindex=\"3\"><input id=\"pickerMeridiem\" class=\"picktime__meridiem--radio\" type=\"radio\" name=\"pickerMeridiem".concat(instance, "\" value=\"am\"><span class=\"picktime__meridiem--span\">AM</span></label><label class=\"picktime__meridiem--label\" tabindex=\"4\"><input id=\"pickerMeridiem\" class=\"picktime__meridiem--radio\" type=\"radio\" name=\"pickerMeridiem").concat(instance, "\" value=\"pm\"><span class=\"picktime__meridiem--span\">PM</span></label></div></div>");
        break;
    }

    return html;
  }

}

_defineProperty(PickTime, "pickers", 0);

module.exports = PickTime;
