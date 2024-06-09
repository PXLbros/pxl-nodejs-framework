export interface FormatTimeOptions {
  time: number;
  format?: 'ms' | 's' | 'auto' | 'hh:mm:ss';
  numDecimals?: number;
  showUnit?: boolean;
}
