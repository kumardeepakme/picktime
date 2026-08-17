/**
 * All display formatting. Nothing here is stored; the controller keeps the
 * machine value and this module derives what the user sees, so display and
 * state can never drift apart.
 */

import type { HourCycle, Meridiem } from './controller.js';
import { fromSecondsOfDay, is12HourCycle } from './controller.js';

/** Fixed UTC midnight. Combined with `timeZone: 'UTC'` this makes output deterministic. */
const REFERENCE = Date.UTC(2000, 0, 1);

const asDate = (secondsOfDay: number): Date =>
  new Date(REFERENCE + secondsOfDay * 1_000);

const isHourCycle = (value: unknown): value is HourCycle =>
  value === 'h11' || value === 'h12' || value === 'h23' || value === 'h24';

/** The hour cycle the locale itself prefers, e.g. h12 for en-US, h23 for de-DE. */
export const resolveHourCycle = (locale?: string): HourCycle => {
  const resolved = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
  }).resolvedOptions().hourCycle;
  return isHourCycle(resolved) ? resolved : 'h12';
};

export const isRtlLocale = (locale?: string): boolean => {
  const resolved = new Intl.Locale(
    locale ?? new Intl.DateTimeFormat().resolvedOptions().locale
  );
  // getTextInfo is newer than the rest of Intl; fall back to LTR when absent.
  const textInfo = (
    resolved as Intl.Locale & { getTextInfo?: () => { direction: string } }
  ).getTextInfo?.();
  return textInfo?.direction === 'rtl';
};

interface FormatOptions {
  locale?: string | undefined;
  hourCycle?: HourCycle | undefined;
  withSeconds?: boolean | undefined;
}

const buildFormatter = ({
  locale,
  hourCycle = 'h12',
  withSeconds = false,
}: FormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hourCycle,
    timeZone: 'UTC',
  });

/** Human-facing time string, e.g. "09:30 AM" or "09:30" depending on locale. */
export const formatTime = (
  secondsOfDay: number,
  options: FormatOptions = {}
): string => buildFormatter(options).format(asDate(secondsOfDay));

/**
 * Locale day-period labels for the AM/PM control. Falls back to "AM"/"PM" when
 * a locale supplies no day period, which happens for 24-hour-only locales.
 */
export const getDayPeriodNames = (
  locale?: string
): Record<Meridiem, string> => {
  const read = (secondsOfDay: number, fallback: string): string => {
    const parts = buildFormatter({ locale, hourCycle: 'h12' }).formatToParts(
      asDate(secondsOfDay)
    );
    return parts.find(part => part.type === 'dayPeriod')?.value ?? fallback;
  };

  return { am: read(9 * 3_600, 'AM'), pm: read(21 * 3_600, 'PM') };
};

/** The separator the locale puts between hour and minute, usually ":". */
export const getTimeSeparator = (
  locale?: string,
  hourCycle: HourCycle = 'h12'
): string => {
  const parts = buildFormatter({ locale, hourCycle }).formatToParts(
    asDate(9 * 3_600 + 30 * 60)
  );
  return parts.find(part => part.type === 'literal')?.value.trim() || ':';
};

/**
 * Screen-reader text for the whole control. Announced via the live region on
 * commit, so a non-sighted user hears the same thing a sighted user reads.
 */
export const describeTime = (
  secondsOfDay: number | null,
  options: FormatOptions = {}
): string => {
  if (secondsOfDay === null) return 'No time selected';
  return formatTime(secondsOfDay, options);
};

/** Value announced by an individual hour/minute/second spinbutton. */
export const describeField = (
  secondsOfDay: number,
  field: 'hours' | 'minutes' | 'seconds',
  hourCycle: HourCycle
): string => {
  const parts = fromSecondsOfDay(secondsOfDay);
  if (field === 'hours') {
    const hours = parts.hours;
    const display = is12HourCycle(hourCycle)
      ? hours % 12 === 0
        ? 12
        : hours % 12
      : hours;
    return `${display} ${display === 1 ? 'hour' : 'hours'}`;
  }
  const value = field === 'minutes' ? parts.minutes : parts.seconds;
  const noun = field === 'minutes' ? 'minute' : 'second';
  return `${value} ${value === 1 ? noun : `${noun}s`}`;
};
