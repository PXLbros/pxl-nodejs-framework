export interface Timer {
  /**
   * Stop the timer and return elapsed time in milliseconds with decimal precision.
   */
  stop(): number;

  /**
   * Get elapsed time since timer start without stopping the timer.
   */
  elapsed(): number;

  /**
   * The start timestamp in milliseconds (performance.now() format).
   */
  readonly startTime: number;
}

export interface TimingResult<T = any> {
  /**
   * Duration in milliseconds with decimal precision.
   */
  duration: number;

  /**
   * The result returned by the measured function.
   */
  result: T;

  /**
   * Start timestamp in milliseconds (performance.now() format).
   */
  startTime: number;

  /**
   * End timestamp in milliseconds (performance.now() format).
   */
  endTime: number;
}

export interface MeasureOptions {
  /**
   * Optional name for the measurement (useful for logging/debugging).
   */
  name?: string;

  /**
   * Whether to log the timing result automatically.
   */
  log?: boolean;

  /**
   * Custom logger function to use if log is true.
   */
  logger?: (message: string, duration: number) => void;
}
