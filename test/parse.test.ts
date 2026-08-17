import { describe, expect, it } from 'vitest';
import { parseHumanTime } from '../src/parse';

const at = (h: number, m = 0, s = 0) => h * 3600 + m * 60 + s;

describe('parseHumanTime - separated input', () => {
  it('parses the obvious forms', () => {
    expect(parseHumanTime('9:30')).toBe(at(9, 30));
    expect(parseHumanTime('21:30')).toBe(at(21, 30));
    expect(parseHumanTime('09:30:15')).toBe(at(9, 30, 15));
    expect(parseHumanTime('9.30')).toBe(at(9, 30));
    expect(parseHumanTime('9 30')).toBe(at(9, 30));
  });

  it('tolerates surrounding whitespace and case', () => {
    expect(parseHumanTime('  9:30 PM  ')).toBe(at(21, 30));
  });
});

describe('parseHumanTime - day periods', () => {
  it('applies am and pm', () => {
    expect(parseHumanTime('9:30 pm')).toBe(at(21, 30));
    expect(parseHumanTime('9:30pm')).toBe(at(21, 30));
    expect(parseHumanTime('9:30 p.m.')).toBe(at(21, 30));
    expect(parseHumanTime('9p')).toBe(at(21));
    expect(parseHumanTime('9a')).toBe(at(9));
  });

  it('maps the 12 o clock edges', () => {
    expect(parseHumanTime('12am')).toBe(0);
    expect(parseHumanTime('12:30am')).toBe(at(0, 30));
    expect(parseHumanTime('12pm')).toBe(at(12));
    expect(parseHumanTime('12:30pm')).toBe(at(12, 30));
  });

  it('rejects an hour that cannot carry a day period', () => {
    expect(parseHumanTime('13:00 pm')).toBeNull();
  });

  it('accepts localised labels', () => {
    const dayPeriods = { am: '午前', pm: '午後' };
    expect(parseHumanTime('午後 9:30', { dayPeriods })).toBe(at(21, 30));
    expect(parseHumanTime('午前 9:30', { dayPeriods })).toBe(at(9, 30));
  });
});

describe('parseHumanTime - compact digits', () => {
  it('expands digit-only entry', () => {
    expect(parseHumanTime('9')).toBe(at(9));
    expect(parseHumanTime('09')).toBe(at(9));
    expect(parseHumanTime('930')).toBe(at(9, 30));
    expect(parseHumanTime('0930')).toBe(at(9, 30));
    expect(parseHumanTime('93015')).toBe(at(9, 30, 15));
    expect(parseHumanTime('093015')).toBe(at(9, 30, 15));
  });

  it('combines compact digits with a day period', () => {
    expect(parseHumanTime('930pm')).toBe(at(21, 30));
  });
});

describe('parseHumanTime - rejections', () => {
  it('returns null rather than throwing', () => {
    for (const bad of [
      '',
      '   ',
      'nope',
      '25:00',
      '9:70',
      '9:30:70',
      '9:3x',
      '1234567',
      '1:2:3:4',
    ]) {
      expect(parseHumanTime(bad)).toBeNull();
    }
  });

  it('parses midnight as 0 rather than as an empty value', () => {
    expect(parseHumanTime('00:00')).toBe(0);
    expect(parseHumanTime('0')).toBe(0);
  });
});
