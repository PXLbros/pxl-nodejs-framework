const getRandomNumber = ({
  min,
  max,
}: {
  min: number;
  max: number;
}): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const clamp = ({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}): number => {
  return Math.min(Math.max(value, min), max);
};

export default {
  getRandomNumber,
  clamp,
};
