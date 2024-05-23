/**
 * Format file size.
 */
function formatFileSize({ bytes }: { bytes: number }): string {
  const sizes = ['bytes', 'kB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 bytes';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const fileSize = (bytes / Math.pow(1024, i)).toFixed(1);

  return `${fileSize} ${sizes[i]}`;
}

export default {
  formatFileSize,
}
