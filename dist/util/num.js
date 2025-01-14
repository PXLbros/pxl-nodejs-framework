const getRandomNumber = ({ min, max }) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};
const clamp = ({ value, min, max }) => {
    return Math.min(Math.max(value, min), max);
};
export default {
    getRandomNumber,
    clamp,
};
//# sourceMappingURL=num.js.map