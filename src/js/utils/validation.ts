export const validateInputEl = (el: HTMLInputElement): void => {
  if (!el) throw new Error('element is not defined');

  if (el.tagName !== 'INPUT' || el.type !== 'text')
    throw new Error('element is not an input text element');

  el.setAttribute('readonly', '');
};

export const validatePickerOptions = (options: any): boolean => {
  if (typeof options !== 'object' || Array.isArray(options))
    throw new Error('options must be an object');

  // TODO: TypeGaurd parameters passed in the object
  /* similar to _validateOptions */

  return true;
};
