import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { pipeline } from 'stream';
import { promisify } from 'node:util';
import ffmpeg from 'fluent-ffmpeg';

const pipelineAsync = promisify(pipeline);

async function convertFile({
  inputFilePath,
  outputFilePath,
  format,
}: {
  inputFilePath: string;
  outputFilePath: string;
  format: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Starting conversion: ${inputFilePath} -> ${outputFilePath} (format: ${format})`);

    const command = ffmpeg(inputFilePath)
      .output(outputFilePath)
      .outputFormat(format === 'jpg' ? 'mjpeg' : format) // Using 'mjpeg' for jpg
      .on('progress', (progress: any) => {
        console.log(`Processing: ${Math.round(progress.percent)}% done`);
      })
      .on('end', () => {
        console.log('Conversion finished successfully');
        resolve();
      })
      .on('error', (err: Error) => {
        console.error('Error during conversion:', err);
        reject(err);
      });

    // Start processing
    command.run();
  });
}

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
    for (const entry of fs.readdirSync(src)) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      copySync(srcPath, destPath);
    }
  } else {
    // Copy file
    fs.copyFileSync(src, dest);
  }
}

/**
 * Download file from URL
 *
 * @param url The URL to download the file from
 * @param destinationPath The path to save the downloaded file
 */
async function downloadFile({ url, destinationPath }: { url: string; destinationPath: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destinationPath);

    https
      .get(url, response => {
        // Check if response status is OK (200–299)
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          pipelineAsync(response, file)
            .then(() => resolve())
            .catch(err => {
              fs.unlink(destinationPath, () => reject(err)); // Clean up partially written file on error
            });
        } else {
          fs.unlink(destinationPath, () => {
            reject(new Error(`Failed to download file, status code: ${response.statusCode}`));
          });
        }
      })
      .on('error', err => {
        fs.unlink(destinationPath, () => reject(err)); // Handle request errors
      });

    // Handle file stream errors
    file.on('error', err => {
      fs.unlink(destinationPath, () => reject(err));
    });
  });
}

/**
 * Format file size.
 *
 * @param bytes The file size in bytes
 */
function formatFileSize({ bytes }: { bytes: number }): string {
  if (bytes === 0) return '0 bytes';
  const units = ['bytes', 'kB', 'MB', 'GB', 'TB'] as const;
  let idx = Math.floor(Math.log(bytes) / Math.log(1024));
  if (idx < 0) idx = 0;
  if (idx >= units.length) idx = units.length - 1;
  const fileSize = (bytes / Math.pow(1024, idx)).toFixed(1);
  let unit: string;
  switch (idx) {
    case 0:
      unit = 'bytes';
      break;
    case 1:
      unit = 'kB';
      break;
    case 2:
      unit = 'MB';
      break;
    case 3:
      unit = 'GB';
      break;
    default:
      unit = 'TB';
  }
  return `${fileSize} ${unit}`;
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
      for (const entry of fs.readdirSync(target)) {
        const entryPath = path.join(target, entry);
        removeSync(entryPath);
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
  convertFile,
  copySync,
  downloadFile,
  formatFileSize,
  removeSync,
};
