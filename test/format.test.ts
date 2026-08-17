import { describe, expect, it } from 'vitest';
import {
  describeField,
  describeTime,
  formatTime,
  getDayPeriodNames,
  getTimeSeparator,
  resolveHourCycle,
} from '../src/format';

const at = (h: number, m = 0, s = 0) => h * 3600 + m * 60 + s;

describe('resolveHourCycle', () => {
  it('reads the preference off the locale instead of hardcoding 12', () => {
    expect(resolveHourCycle('en-US')).toBe('h12');
    expect(resolveHourCycle('de-DE')).toBe('h23');
    expect(resolveHourCycle('en-GB')).toBe('h23');
  });
});

describe('formatTime', () => {
  it('formats a 12-hour locale with a day period', () => {
    const formatted = formatTime(at(9, 30), {
      locale: 'en-US',
      hourCycle: 'h12',
    });
    expect(formatted).toMatch(/09:30/);
    expect(formatted.toLowerCase()).toContain('am');
  });

  it('formats a 24-hour locale without a day period', () => {
    const formatted = formatTime(at(21, 5), {
      locale: 'de-DE',
      hourCycle: 'h23',
    });
    expect(formatted).toContain('21:05');
    expect(formatted.toLowerCase()).not.toContain('pm');
  });

  it('includes seconds only when asked', () => {
    expect(
      formatTime(at(9, 30, 15), { locale: 'en-GB', hourCycle: 'h23' })
    ).toBe('09:30');
    expect(
      formatTime(at(9, 30, 15), {
        locale: 'en-GB',
        hourCycle: 'h23',
        withSeconds: true,
      })
    ).toBe('09:30:15');
  });

  it('renders midnight and noon distinctly on a 12-hour clock', () => {
    const midnight = formatTime(0, { locale: 'en-US', hourCycle: 'h12' });
    const noon = formatTime(at(12), { locale: 'en-US', hourCycle: 'h12' });
    expect(midnight.toLowerCase()).toContain('am');
    expect(noon.toLowerCase()).toContain('pm');
  });
});

describe('getDayPeriodNames', () => {
  it('returns localised labels rather than hardcoded English', () => {
    const en = getDayPeriodNames('en-US');
    expect(en.am.toLowerCase()).toContain('am');
    expect(en.pm.toLowerCase()).toContain('pm');

    const ja = getDayPeriodNames('ja-JP');
    expect(ja.am).not.toBe(ja.pm);
  });
});

describe('getTimeSeparator', () => {
  it('finds the separator the locale uses', () => {
    expect(getTimeSeparator('en-US', 'h12')).toBe(':');
    expect(getTimeSeparator('de-DE', 'h23')).toBe(':');
  });
});

describe('describeTime / describeField', () => {
  it('describes an empty value', () => {
    expect(describeTime(null)).toBe('No time selected');
  });

  it('singularises correctly', () => {
    expect(describeField(at(1, 1, 1), 'hours', 'h12')).toBe('1 hour');
    expect(describeField(at(1, 1, 1), 'minutes', 'h12')).toBe('1 minute');
    expect(describeField(at(1, 1, 1), 'seconds', 'h12')).toBe('1 second');
    expect(describeField(at(2, 2, 2), 'hours', 'h12')).toBe('2 hours');
    expect(describeField(at(2, 2, 2), 'minutes', 'h12')).toBe('2 minutes');
  });

  it('announces the 12-hour dial value, not the raw hour', () => {
    expect(describeField(at(13), 'hours', 'h12')).toBe('1 hour');
    expect(describeField(at(0), 'hours', 'h12')).toBe('12 hours');
    expect(describeField(at(13), 'hours', 'h23')).toBe('13 hours');
  });
});
