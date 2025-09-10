import type { FormatRelativeTimeOptions, FormatTimeOptions } from './time.interface.js';
import Timing from './timing.js';

/**
 * Calculate elapsed time in milliseconds using process.hrtime().
 *
 * @deprecated Use calculateElapsedTimeMs() or Timing utilities instead.
 */
const calculateElapsedTime = ({ startTime }: { startTime: [number, number] }): number => {
  const endTime = process.hrtime(startTime);
  const elapsedTime = (endTime[0] * 1e9 + endTime[1]) / 1e6;

  return elapsedTime;
};

/**
 * Calculate elapsed time in milliseconds using performance.now().
 * More accurate and simpler than hrtime-based timing.
 */
const calculateElapsedTimeMs = ({ startTime }: { startTime: number }): number => {
  return performance.now() - startTime;
};

/**
 * Format time.
 */
const formatTime = ({ time, format = 'auto', numDecimals = 0, showUnit = true }: FormatTimeOptions): string => {
  let formattedTime: number;
  let formattedTimeText: string;

  if (format === 's' || (format === 'auto' && time < 60000)) {
    formattedTime = time / 1000;
    formattedTimeText = formattedTime.toFixed(numDecimals);
    format = 's'; // Ensure the unit is correctly displayed
  } else if (format === 'hh:mm:ss' || (format === 'auto' && time >= 60000)) {
    const totalSeconds = Math.floor(time / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    formattedTimeText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return formattedTimeText; // No need to append unit for 'hh:mm:ss'
  } else {
    formattedTime = time;
    formattedTimeText = formattedTime.toFixed(numDecimals);
    format = 'ms'; // Ensure the unit is correctly displayed
  }

  const unit = format === 'ms' || format === 's' ? format : '';

  return showUnit ? `${formattedTimeText}${unit}` : formattedTimeText;
};

/**
 * Sleep for a specified number of seconds.
 */
const sleep = ({ seconds }: { seconds: number }): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(resolve, seconds * 1000);
  });
};

/**
 * Format a date as relative time (e.g., "in 3 minutes", "2 hours ago").
 */
const formatRelativeTime = ({
  date,
  baseDate = new Date(),
  includeSeconds = false,
}: FormatRelativeTimeOptions): string => {
  const diffInMs = date.getTime() - baseDate.getTime();
  const diffInSeconds = Math.abs(Math.floor(diffInMs / 1000));
  const isFuture = diffInMs > 0;

  // Time units in seconds
  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  const month = day * 30; // Approximate
  const year = day * 365; // Approximate

  let value: number;
  let unit: string;

  if (diffInSeconds < minute) {
    if (!includeSeconds && diffInSeconds < 60) {
      return 'just now';
    }
    value = diffInSeconds;
    unit = value === 1 ? 'second' : 'seconds';
  } else if (diffInSeconds < hour) {
    value = Math.floor(diffInSeconds / minute);
    unit = value === 1 ? 'minute' : 'minutes';
  } else if (diffInSeconds < day) {
    value = Math.floor(diffInSeconds / hour);
    unit = value === 1 ? 'hour' : 'hours';
  } else if (diffInSeconds < week) {
    value = Math.floor(diffInSeconds / day);
    unit = value === 1 ? 'day' : 'days';
  } else if (diffInSeconds < month) {
    value = Math.floor(diffInSeconds / week);
    unit = value === 1 ? 'week' : 'weeks';
  } else if (diffInSeconds < year) {
    value = Math.floor(diffInSeconds / month);
    unit = value === 1 ? 'month' : 'months';
  } else {
    value = Math.floor(diffInSeconds / year);
    unit = value === 1 ? 'year' : 'years';
  }

  if (isFuture) {
    return `in ${value} ${unit}`;
  }
  return `${value} ${unit} ago`;
};

export default {
  calculateElapsedTime,
  calculateElapsedTimeMs,
  formatTime,
  formatRelativeTime,
  sleep,
  // Modern timing utilities
  now: Timing.now,
  start: Timing.start,
  measure: Timing.measure,
  measureSync: Timing.measureSync,
  duration: Timing.duration,
  hrtimeToMs: Timing.hrtimeToMs,
  msToHrtime: Timing.msToHrtime,
};
