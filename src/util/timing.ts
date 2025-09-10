import type { MeasureOptions, Timer, TimingResult } from './timing.interface.js';

/**
 * Timer instance implementation using performance.now()
 */
class TimerInstance implements Timer {
  public readonly startTime: number;

  constructor(startTime: number) {
    this.startTime = startTime;
  }

  stop(): number {
    return performance.now() - this.startTime;
  }

  elapsed(): number {
    return performance.now() - this.startTime;
  }
}

/**
 * Modern high-resolution timing utility using performance.now()
 *
 * Provides simple APIs for measuring function execution time and manual timing.
 * All durations are returned in milliseconds with decimal precision.
 */
class Timing {
  /**
   * Get current high-resolution timestamp in milliseconds.
   * Uses performance.now() which provides sub-millisecond precision.
   */
  static now(): number {
    return performance.now();
  }

  /**
   * Start a timer and return a Timer instance.
   * Call timer.stop() to get elapsed time in milliseconds.
   */
  static start(): Timer {
    return new TimerInstance(performance.now());
  }

  /**
   * Measure the execution time of a function (async or sync).
   * Returns both the function result and timing information.
   */
  static async measure<T>(fn: () => T | Promise<T>, options: MeasureOptions = {}): Promise<TimingResult<T>> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (options.log) {
      const name = options.name ?? 'Anonymous function';
      const message = `${name} executed`;
      if (options.logger) {
        options.logger(message, duration);
      } else {
        console.log(`${message} in ${duration.toFixed(3)}ms`);
      }
    }

    return {
      result,
      duration,
      startTime,
      endTime,
    };
  }

  /**
   * Measure the execution time of a synchronous function.
   * Returns both the function result and timing information.
   */
  static measureSync<T>(fn: () => T, options: MeasureOptions = {}): TimingResult<T> {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (options.log) {
      const name = options.name ?? 'Anonymous function';
      const message = `${name} executed`;
      if (options.logger) {
        options.logger(message, duration);
      } else {
        console.log(`${message} in ${duration.toFixed(3)}ms`);
      }
    }

    return {
      result,
      duration,
      startTime,
      endTime,
    };
  }

  /**
   * Calculate duration between two timestamps in milliseconds.
   * Both timestamps should be from performance.now().
   */
  static duration(startTime: number, endTime: number): number {
    return endTime - startTime;
  }

  /**
   * Convert hrtime tuple to milliseconds with decimal precision.
   * Utility for migrating from process.hrtime() usage.
   *
   * @deprecated Use performance.now() based methods instead
   */
  static hrtimeToMs(hrtime: [number, number]): number {
    return hrtime[0] * 1000 + hrtime[1] / 1e6;
  }

  /**
   * Convert milliseconds with decimal precision to hrtime-like format.
   * Utility for backward compatibility.
   *
   * @deprecated Use performance.now() based methods instead
   */
  static msToHrtime(milliseconds: number): [number, number] {
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = Math.round((milliseconds % 1000) * 1e6);
    return [seconds, nanoseconds];
  }
}

export default Timing;
