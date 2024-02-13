export const calculateElapsedTime = ({ startTime }: { startTime: [number, number] }): number => {
  const endTime = process.hrtime(startTime);
  const elapsedTime = (endTime[0] * 1e9 + endTime[1]) / 1e6;

  return elapsedTime;
};

export const formatTime = ({
  time,
  format = 'ms',
  numDecimals = 0,
  showUnit = true,
}: {
  time: number;
  format?: 'ms' | 's';
  numDecimals?: number;
  showUnit?: boolean;
}): string => {
  let formattedTime: number;

  if (format === 's') {
    formattedTime = time / 1000;
  } else {
    formattedTime = time;
  }

  const formattedTimeText =
    typeof numDecimals === 'number' ? formattedTime.toFixed(numDecimals) : formattedTime.toString();

  const formattedTimeTextOutput = showUnit ? `${formattedTimeText}${format}` : formattedTimeText;

  return formattedTimeTextOutput;
};

export const sleep = ({ seconds }: { seconds: number }): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
};

