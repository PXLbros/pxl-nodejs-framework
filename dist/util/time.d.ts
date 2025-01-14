import { FormatTimeOptions } from './time.interface.js';
declare const _default: {
    calculateElapsedTime: ({ startTime }: {
        startTime: [number, number];
    }) => number;
    formatTime: ({ time, format, numDecimals, showUnit, }: FormatTimeOptions) => string;
    sleep: ({ seconds }: {
        seconds: number;
    }) => Promise<void>;
};
export default _default;
//# sourceMappingURL=time.d.ts.map