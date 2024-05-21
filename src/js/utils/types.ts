export interface PickerOptions {
  animation?: string;
  arrow?: boolean;
  clock?: number;
  time?: {
    hours?: number;
    minutes?: number;
    meridiem?: string;
  };
  format?: string;
  input?: HTMLInputElement | null;
  margin?: {
    top?: number;
    left?: number;
  };
  minuteSteps?: number;
  upDownKeys?: boolean;
  wheelSpin?: boolean;
  theme?: string;
}
