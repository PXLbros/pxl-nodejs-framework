import { FormatTimeOptions } from './time.interface.js';

/**
 * Calculate elapsed time in milliseconds.
 */
const calculateElapsedTime = ({ startTime }: { startTime: [number, number] }): number => {
  const endTime = process.hrtime(startTime);
  const elapsedTime = (endTime[0] * 1e9 + endTime[1]) / 1e6;

  return elapsedTime;
};

/**
 * Format time.
 */
const formatTime = ({
  time,
  format = 'auto',
  numDecimals = 0,
  showUnit = true,
}: FormatTimeOptions): string => {
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
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
};

export default {
  calculateElapsedTime,
  formatTime,
  sleep,
};
