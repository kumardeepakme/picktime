import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PickTime } from '../src/index';

/**
 * Exercises the v2 surface exactly as the old README documented it, so a v2
 * user upgrading blind still gets working behaviour.
 */

let input: HTMLInputElement;

beforeEach(() => {
  document.body.innerHTML = '';
  input = document.createElement('input');
  input.type = 'text';
  input.name = 'legacy';
  document.body.append(input);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('v2 constructor', () => {
  // Must run first: the deprecation warning fires once per module instance,
  // and browser mode offers no way to re-import a fresh copy.
  it('warns that the API is deprecated', () => {
    new PickTime(input);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('mounts an element next to the original input', () => {
    const picker = new PickTime(input, { clock: 12 });
    expect(picker.element.tagName.toLowerCase()).toBe('pick-time');
    expect(input.nextElementSibling).toBe(picker.element);
    expect(input.hidden).toBe(true);
  });

  it('rejects a non-input first argument', () => {
    expect(
      () => new PickTime(document.createElement('div') as HTMLInputElement)
    ).toThrow(TypeError);
  });

  it('carries the name across so the form still submits', () => {
    const form = document.createElement('form');
    input.remove();
    form.append(input);
    document.body.append(form);

    const picker = new PickTime(input, {
      clock: 12,
      time: { hours: 9, minutes: 30, meridiem: 'am' },
    });
    expect(new FormData(form).get('legacy')).toBe('09:30');
    picker.destroy();
  });
});

describe('v2 options mapping', () => {
  it('maps clock 24 onto the 24-hour cycle', () => {
    const picker = new PickTime(input, {
      clock: 24,
      time: { hours: 21, minutes: 5, meridiem: null },
    });
    expect(picker.element.value).toBe('21:05');
    expect(picker.element.getAttribute('hour-cycle')).toBe('h23');
  });

  it('maps a 12-hour pm time', () => {
    const picker = new PickTime(input, {
      clock: 12,
      time: { hours: 9, minutes: 30, meridiem: 'pm' },
    });
    expect(picker.element.value).toBe('21:30');
  });

  it('maps minuteSteps and theme', () => {
    const picker = new PickTime(input, { minuteSteps: 15, theme: 'dark' });
    expect(picker.element.getAttribute('minute-step')).toBe('15');
    expect(picker.element.getAttribute('theme')).toBe('dark');
  });
});

describe('v2 methods', () => {
  it('setTime updates the value', () => {
    const picker = new PickTime(input, { clock: 12 });
    picker.setTime({ hours: 3, minutes: 45, meridiem: 'pm' });
    expect(picker.element.value).toBe('15:45');
  });

  it('disable and enable toggle the control', () => {
    const picker = new PickTime(input);
    picker.disable();
    expect(picker.element.disabled).toBe(true);
    picker.enable();
    expect(picker.element.disabled).toBe(false);
  });

  it('destroy removes the element and restores the input', () => {
    const picker = new PickTime(input);
    picker.destroy();
    expect(picker.element.isConnected).toBe(false);
    expect(input.hidden).toBe(false);
  });

  it('restores the original input state exactly', () => {
    input.setAttribute('hidden', 'until-found');
    input.disabled = true;
    input.value = 'original';
    const picker = new PickTime(input);
    picker.destroy();
    expect(input.getAttribute('hidden')).toBe('until-found');
    expect(input.disabled).toBe(true);
    expect(input.value).toBe('original');
  });

  it('does not reset setTime when another option changes', () => {
    const picker = new PickTime(input, {
      time: { hours: 9, minutes: 30, meridiem: 'am' },
    });
    picker.setTime({ hours: 4, minutes: 15, meridiem: 'pm' });
    picker.disable();
    expect(picker.element.value).toBe('16:15');
  });
});

describe('v2 getTime', () => {
  it('returns the documented shape', () => {
    const picker = new PickTime(input, {
      clock: 12,
      time: { hours: 10, minutes: 30, meridiem: 'am' },
    });
    const out = picker.getTime;
    expect(out.time).toBe('10:30');
    expect(out.meridiem).toBe('am');
    expect(out.displayTime).toMatch(/10:30/);
    expect(out.utcOffset).toMatch(/^[+-]\d{2}:\d{2}$/);
  });

  it('returns an empty shape when there is no value', () => {
    const picker = new PickTime(input);
    expect(picker.getTime.time).toBe('');
    expect(picker.getTime.meridiem).toBeNull();
  });
});

describe('v2 input mirroring', () => {
  it('writes a formatted value back to the original input', () => {
    const picker = new PickTime(input, {
      clock: 12,
      time: { hours: 10, minutes: 30, meridiem: 'am' },
    });
    expect(input.value).toMatch(/10:30/);

    picker.setTime({ hours: 4, minutes: 15, meridiem: 'pm' });
    expect(input.value).toMatch(/04:15/);
  });

  it('fires change on the original input, as v2 did', () => {
    const picker = new PickTime(input, { clock: 12 });
    const spy = vi.fn();
    input.addEventListener('change', spy);
    picker.setTime({ hours: 1, minutes: 0, meridiem: 'pm' });
    expect(spy).toHaveBeenCalled();
  });
});
