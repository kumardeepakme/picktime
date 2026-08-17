/**
 * Lenient parsing of what a person actually types.
 *
 * v2 sidestepped this entirely by forcing `readonly` on the input, which meant
 * a keyboard user could never enter a time at all. Anything unparseable is
 * reported as bad input rather than thrown, matching how `<input type="time">`
 * treats a partially typed value.
 */

import type { Meridiem } from './controller.js';
import { toSecondsOfDay } from './controller.js';

export interface ParseHumanOptions {
  /** Localised day-period labels, so "午前" works as well as "am". */
  dayPeriods?: Record<Meridiem, string> | undefined;
}

interface Detected {
  rest: string;
  meridiem: Meridiem | null;
}

const stripMeridiem = (
  input: string,
  dayPeriods: Record<Meridiem, string> | undefined
): Detected => {
  // Locale labels win, so a locale whose pm marker contains "a" is not
  // misread by the ASCII rules below.
  for (const key of ['am', 'pm'] as const) {
    const label = dayPeriods?.[key]?.toLowerCase().trim();
    if (label && input.includes(label)) {
      return { rest: input.replace(label, ' '), meridiem: key };
    }
  }

  const ascii = /(?:^|[\s.])?([ap])\.?\s?m?\.?\s*$/.exec(input);
  if (ascii) {
    return {
      rest: input.slice(0, ascii.index),
      meridiem: ascii[1] === 'a' ? 'am' : 'pm',
    };
  }

  return { rest: input, meridiem: null };
};

/** Splits "093015" style compact input into hour/minute/second groups. */
const splitCompact = (digits: string): number[] | null => {
  switch (digits.length) {
    case 1:
    case 2:
      return [Number(digits)];
    case 3:
      return [Number(digits.slice(0, 1)), Number(digits.slice(1))];
    case 4:
      return [Number(digits.slice(0, 2)), Number(digits.slice(2))];
    case 5:
      return [
        Number(digits.slice(0, 1)),
        Number(digits.slice(1, 3)),
        Number(digits.slice(3)),
      ];
    case 6:
      return [
        Number(digits.slice(0, 2)),
        Number(digits.slice(2, 4)),
        Number(digits.slice(4)),
      ];
    default:
      return null;
  }
};

export const parseHumanTime = (
  input: string,
  options: ParseHumanOptions = {}
): number | null => {
  const normalised = input.trim().toLowerCase();
  if (normalised === '') return null;

  const { rest, meridiem } = stripMeridiem(normalised, options.dayPeriods);

  const body = rest.trim();
  if (body === '') return null;

  const separated = body.split(/[:.\s]+/).filter(Boolean);
  const groups =
    separated.length > 1
      ? separated.map(Number)
      : splitCompact(separated[0] ?? '');

  if (!groups || groups.length > 3 || groups.some(n => !Number.isInteger(n))) {
    return null;
  }
  // Reject stray characters that survived the split, e.g. "9:3x".
  if (!/^[\d:.\s]+$/.test(body)) return null;

  const [hours = 0, minutes = 0, seconds = 0] = groups;
  if (minutes > 59 || seconds > 59 || hours < 0) return null;

  if (meridiem) {
    if (hours > 12) return null;
    const base = hours % 12;
    return toSecondsOfDay({
      hours: meridiem === 'pm' ? base + 12 : base,
      minutes,
      seconds,
    });
  }

  if (hours > 23) return null;
  return toSecondsOfDay({ hours, minutes, seconds });
};
