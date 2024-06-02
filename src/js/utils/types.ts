export interface PickerOptions {
  animation?: string;
  arrow?: boolean;
  clock?: number;
  minuteSteps?: number;
  offset?: {
    left?: number;
    top?: number;
  };
  theme?: string;
  time?: Time;
  upDownKeys?: boolean;
  wheelSpin?: boolean;
}

export interface Time {
  hours: number;
  minutes: number;
  meridiem: string | null;
}

export interface TimeOutput {
  displayTime: string;
  meridiem: string | null;
  time: string;
  utcOffset: string;
}
