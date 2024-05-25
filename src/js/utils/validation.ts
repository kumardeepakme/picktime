import { PickerOptions } from './types';

export const validateInputEl = (el: HTMLInputElement): void => {
  if (!el) throw new Error('element is not defined');

  if (el.tagName !== 'INPUT' || el.type !== 'text')
    throw new Error('element is not an input text element');

  el.setAttribute('readonly', '');
};

export const validatePickerOptions = (options: PickerOptions): boolean => {
  if (typeof options !== 'object' || Array.isArray(options))
    throw new Error('options must be an object');

  // animation
  if ('animation' in options && typeof options.animation !== 'string')
    throw new Error('"animation" property must be of type string');
  if (options.animation && options.animation.trim() === '')
    throw new Error('"animation" property must not be an empty string');

  // arrow
  if ('arrow' in options && typeof options.arrow !== 'boolean')
    throw new Error('"arrow" property must be of type boolean');

  // clock
  if ('clock' in options && typeof options.clock !== 'number')
    throw new Error('"clock" property must be of type number');
  if (options.clock !== 12 && options.clock !== 24)
    throw new Error('"clock" property only accepts 12/24 as a value');

  // minuteSteps
  if ('minuteSteps' in options && typeof options.minuteSteps !== 'number')
    throw new Error('"minuteSteps" property must be of type number');
  if (
    options.minuteSteps &&
    (options.minuteSteps < 1 || options.minuteSteps > 59)
  )
    throw new RangeError('"minuteSteps" property must range between 1-59');

  // offset
  if (
    'offset' in options &&
    (typeof options.offset === 'object' || !Array.isArray(options.offset))
  ) {
    if (options.offset?.top && !Number.isInteger(options.offset.top))
      throw new Error('"offset.top" must be an integer');

    if (options.offset?.left && !Number.isInteger(options.offset.left))
      throw new Error('"offset.left" must be an integer');
  }

  // theme
  if ('theme' in options && typeof options.theme !== 'string')
    throw new Error('"theme" property must be of type string');
  if (options.theme && options.theme!.trim() === '')
    throw new Error('"theme" property must not be an empty string');

  // time
  if (
    'time' in options &&
    (typeof options.time === 'object' || !Array.isArray(options.time))
  ) {
    if (options.time?.hours && !Number.isInteger(options.time.hours))
      throw new Error('"time.hours" must be an integer');
    if (
      options.time?.hours &&
      (options.time.hours < 0 || options.time.hours > 23)
    )
      throw new RangeError('"time.hours" property must range between 1-23');

    if (options.time?.minutes && !Number.isInteger(options.time.minutes))
      throw new Error('"time.minutes" must be an integer');
    if (
      options.time?.minutes &&
      (options.time.minutes < 0 || options.time.minutes > 59)
    )
      throw new RangeError('"time.minutes" property must range between 1-59');

    if (options.time?.meridiem && typeof options.time.meridiem !== 'string')
      throw new Error('"time.meridiem" must be a string');

    if (options.time?.meridiem) {
      if (
        options.time?.meridiem.toLowerCase() !== 'am' ||
        options.time?.meridiem.toLowerCase() !== 'pm'
      )
        throw new Error('"time.meridiem" must be a string of am/pm');
    }
  }

  // upDownKeys
  if ('upDownKeys' in options && typeof options.upDownKeys !== 'boolean')
    throw new Error('"upDownKeys" property must be of type boolean');

  // wheelSpin
  if ('wheelSpin' in options && typeof options.wheelSpin !== 'boolean')
    throw new Error('"wheelSpin" property must be of type boolean');

  return true;
};
