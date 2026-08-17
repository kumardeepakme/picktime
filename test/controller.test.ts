import { describe, expect, it } from 'vitest';
import {
  fromSecondsOfDay,
  parseTimeValue,
  SECONDS_PER_DAY,
  TimeController,
  toSecondsOfDay,
  toTimeValue,
} from '../src/controller';

describe('toSecondsOfDay / fromSecondsOfDay', () => {
  it('round-trips midnight', () => {
    expect(toSecondsOfDay({ hours: 0, minutes: 0, seconds: 0 })).toBe(0);
    expect(fromSecondsOfDay(0)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it('round-trips the last second of the day', () => {
    const parts = { hours: 23, minutes: 59, seconds: 59 };
    expect(toSecondsOfDay(parts)).toBe(SECONDS_PER_DAY - 1);
    expect(fromSecondsOfDay(SECONDS_PER_DAY - 1)).toEqual(parts);
  });

  it('normalises values outside the day', () => {
    expect(fromSecondsOfDay(SECONDS_PER_DAY + 60)).toEqual({
      hours: 0,
      minutes: 1,
      seconds: 0,
    });
    expect(fromSecondsOfDay(-60)).toEqual({
      hours: 23,
      minutes: 59,
      seconds: 0,
    });
  });
});

describe('parseTimeValue', () => {
  it('parses HH:mm and HH:mm:ss', () => {
    expect(parseTimeValue('09:30')).toBe(9 * 3600 + 30 * 60);
    expect(parseTimeValue('09:30:15')).toBe(9 * 3600 + 30 * 60 + 15);
  });

  it('parses midnight as 0, not as falsy-null', () => {
    expect(parseTimeValue('00:00')).toBe(0);
    expect(parseTimeValue('00:00:00')).toBe(0);
  });

  it('rejects malformed and out-of-range input', () => {
    for (const bad of ['', 'nope', '24:00', '09:60', '09:30:60', '9:3']) {
      expect(parseTimeValue(bad)).toBeNull();
    }
  });
});

describe('toTimeValue', () => {
  it('omits seconds unless asked', () => {
    expect(toTimeValue(9 * 3600 + 30 * 60)).toBe('09:30');
    expect(toTimeValue(9 * 3600 + 30 * 60, true)).toBe('09:30:00');
  });

  it('zero-pads', () => {
    expect(toTimeValue(0)).toBe('00:00');
    expect(toTimeValue(3600 + 60 + 1, true)).toBe('01:01:01');
  });
});

describe('TimeController value', () => {
  it('starts empty', () => {
    expect(new TimeController().value).toBeNull();
  });

  it('keeps midnight as a real value rather than coercing it away', () => {
    // v2 bug: `options.time.hours || 12` turned hour 0 into 12.
    const c = new TimeController();
    c.value = '00:00';
    expect(c.value).toBe('00:00');
    expect(c.parts).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it('ignores malformed assignments and reports bad input', () => {
    const c = new TimeController();
    c.value = 'not a time';
    expect(c.value).toBeNull();
    expect(c.validity.badInput).toBe(true);
  });
});

describe('TimeController.step - hours', () => {
  it('wraps 23 to 0 on a 24-hour clock', () => {
    const c = new TimeController({ hourCycle: 'h23' });
    c.value = '23:30';
    c.step('hours', 1);
    expect(c.value).toBe('00:30');
  });

  it('wraps 0 back to 23 on a 24-hour clock', () => {
    const c = new TimeController({ hourCycle: 'h23' });
    c.value = '00:30';
    c.step('hours', -1);
    expect(c.value).toBe('23:30');
  });

  it('wraps within the meridiem half on a 12-hour clock', () => {
    // 11 AM -> 12 PM would be a carry; native time inputs wrap in-field instead.
    const c = new TimeController({ hourCycle: 'h12' });
    c.value = '11:00';
    c.step('hours', 1);
    expect(c.value).toBe('00:00');
    expect(c.meridiem).toBe('am');
  });

  it('keeps the afternoon meridiem when wrapping', () => {
    const c = new TimeController({ hourCycle: 'h12' });
    c.value = '23:00'; // 11 PM
    c.step('hours', 1);
    expect(c.value).toBe('12:00'); // 12 PM
    expect(c.meridiem).toBe('pm');
  });
});

describe('TimeController.step - minutes', () => {
  it('wraps without touching the hour', () => {
    const c = new TimeController();
    c.value = '09:59';
    c.step('minutes', 1);
    expect(c.value).toBe('09:00');
  });

  it('honours a step that divides 60', () => {
    const c = new TimeController({ minuteStep: 15 });
    c.value = '09:45';
    c.step('minutes', 1);
    expect(c.value).toBe('09:00');
  });

  it('wraps by modulo for a step that does not divide 60', () => {
    // v2 bug: `if (minutes > 60 - step) minutes = 0` skipped reachable values.
    const c = new TimeController({ minuteStep: 7 });
    c.value = '09:56';
    c.step('minutes', 1);
    expect(c.value).toBe('09:03');
  });

  it('steps backwards past zero', () => {
    const c = new TimeController({ minuteStep: 15 });
    c.value = '09:00';
    c.step('minutes', -1);
    expect(c.value).toBe('09:45');
  });
});

describe('TimeController.meridiem', () => {
  it('reports am before noon and pm from noon', () => {
    const c = new TimeController();
    c.value = '11:59';
    expect(c.meridiem).toBe('am');
    c.value = '12:00';
    expect(c.meridiem).toBe('pm');
    c.value = '00:00';
    expect(c.meridiem).toBe('am');
  });

  it('moves the value by twelve hours when switched', () => {
    const c = new TimeController();
    c.value = '09:30';
    c.meridiem = 'pm';
    expect(c.value).toBe('21:30');
    c.meridiem = 'am';
    expect(c.value).toBe('09:30');
  });

  it('is a no-op when already in that half', () => {
    const c = new TimeController();
    c.value = '09:30';
    c.meridiem = 'am';
    expect(c.value).toBe('09:30');
  });

  it('handles the midnight and noon edges', () => {
    const c = new TimeController();
    c.value = '00:15'; // 12:15 AM
    c.meridiem = 'pm';
    expect(c.value).toBe('12:15');
    c.meridiem = 'am';
    expect(c.value).toBe('00:15');
  });
});

describe('TimeController.displayHours', () => {
  it('maps midnight and noon per hour cycle', () => {
    const c = new TimeController({ hourCycle: 'h12' });
    c.value = '00:00';
    expect(c.displayHours).toBe(12);
    c.value = '12:00';
    expect(c.displayHours).toBe(12);
    c.value = '13:00';
    expect(c.displayHours).toBe(1);
  });

  it('uses 0-11 for h11 and 1-24 for h24', () => {
    const h11 = new TimeController({ hourCycle: 'h11' });
    h11.value = '00:00';
    expect(h11.displayHours).toBe(0);

    const h24 = new TimeController({ hourCycle: 'h24' });
    h24.value = '00:00';
    expect(h24.displayHours).toBe(24);
    h24.value = '13:00';
    expect(h24.displayHours).toBe(13);
  });
});

describe('TimeController range validity', () => {
  it('flags values below min and above max', () => {
    const c = new TimeController({ min: '09:00', max: '17:00' });
    c.value = '08:59';
    expect(c.validity.rangeUnderflow).toBe(true);
    c.value = '17:01';
    expect(c.validity.rangeOverflow).toBe(true);
    c.value = '12:00';
    expect(c.validity.rangeUnderflow).toBe(false);
    expect(c.validity.rangeOverflow).toBe(false);
  });

  it('treats min > max as a range that wraps midnight', () => {
    // Matches the HTML spec for <input type="time"> reversed ranges.
    const c = new TimeController({ min: '22:00', max: '06:00' });
    c.value = '23:30';
    expect(c.inRange).toBe(true);
    c.value = '02:00';
    expect(c.inRange).toBe(true);
    c.value = '12:00';
    expect(c.inRange).toBe(false);
  });

  it('reports valueMissing only when required', () => {
    const c = new TimeController();
    expect(c.validity.valueMissing).toBe(false);
    c.required = true;
    expect(c.validity.valueMissing).toBe(true);
    c.value = '09:00';
    expect(c.validity.valueMissing).toBe(false);
  });
});

describe('TimeController seconds', () => {
  it('round-trips a seconds value and wraps the field', () => {
    const c = new TimeController({ withSeconds: true, secondStep: 30 });
    c.value = '09:30:30';
    expect(c.value).toBe('09:30:30');
    c.step('seconds', 1);
    expect(c.value).toBe('09:30:00');
  });

  it('drops hidden seconds so string and numeric values stay consistent', () => {
    const c = new TimeController();
    c.value = '09:30:45';
    expect(c.value).toBe('09:30');
    expect(c.secondsOfDay).toBe(9 * 3600 + 30 * 60);
  });

  it('clears non-finite numeric assignments', () => {
    const c = new TimeController();
    c.value = '09:30';
    c.secondsOfDay = Number.NaN;
    expect(c.value).toBeNull();
    expect(c.secondsOfDay).toBeNull();
  });
});

describe('TimeController unparseable assignment', () => {
  it('clears a previously valid value, as <input type="time"> does', () => {
    const c = new TimeController();
    c.value = '09:30';
    c.value = 'garbage';
    expect(c.value).toBeNull();
    expect(c.validity.badInput).toBe(true);
  });

  it('recovers once a valid value is assigned', () => {
    const c = new TimeController();
    c.value = 'garbage';
    c.value = '10:15';
    expect(c.value).toBe('10:15');
    expect(c.validity.badInput).toBe(false);
  });
});
