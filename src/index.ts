import { definePickTime, type PickTimeElement } from './element.js';

export type {
  LegacyOptions,
  LegacyTime,
  LegacyTimeOutput,
} from './compat.js';
export { PickTime } from './compat.js';
export type {
  HourCycle,
  Meridiem,
  TimeField,
  TimeParts,
  TimeValidity,
} from './controller.js';
export {
  fromSecondsOfDay,
  parseTimeValue,
  TimeController,
  toSecondsOfDay,
  toTimeValue,
} from './controller.js';
export { definePickTime, PickTimeElement } from './element.js';
export { formatTime, getDayPeriodNames, resolveHourCycle } from './format.js';
export { parseHumanTime } from './parse.js';
export type { Placement } from './position.js';

definePickTime();

declare global {
  interface HTMLElementTagNameMap {
    'pick-time': PickTimeElement;
  }
}
