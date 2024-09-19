import * as fs from 'fs';
import * as path from 'path';

/**
 * Copy a file or directory synchronously
 *
 * @param src The source path
 * @param dest The destination path
 */
function copySync(src: string, dest: string): void {
  const stats = fs.statSync(src);

  if (stats.isDirectory()) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }

    // Read directory contents
    const entries = fs.readdirSync(src);

    // Copy each file/folder
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);

      // Recursively copy directory or file
      copySync(srcPath, destPath);
    }
  } else {
    // Copy file
    fs.copyFileSync(src, dest);
  }
}

/**
 * Format file size.
 *
 * @param bytes The file size in bytes
 */
function formatFileSize({ bytes }: { bytes: number }): string {
  const sizes = ['bytes', 'kB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 bytes';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const fileSize = (bytes / Math.pow(1024, i)).toFixed(1);

  return `${fileSize} ${sizes[i]}`;
}

/**
 * Remove a file or directory synchronously
 *
 * @param target The path to the file or directory to remove
 */
function removeSync(target: string): void {
  if (fs.existsSync(target)) {
    const stats = fs.statSync(target);

    if (stats.isDirectory()) {
      // Read the directory contents
      const entries = fs.readdirSync(target);

      // Recursively remove directory contents
      for (const entry of entries) {
        const entryPath = path.join(target, entry);
        removeSync(entryPath); // Recursively remove each file/folder
      }

      // Remove the directory itself
      fs.rmdirSync(target);
    } else {
      // Remove the file
      fs.unlinkSync(target);
    }
  } else {
    console.warn(`Path ${target} does not exist.`);
  }
}

export default {
  copySync,
  formatFileSize,
  removeSync,
}
