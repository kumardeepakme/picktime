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
  time?: {
    hours?: number;
    minutes?: number;
    meridiem?: string | null;
  };
  upDownKeys?: boolean;
  wheelSpin?: boolean;
}
