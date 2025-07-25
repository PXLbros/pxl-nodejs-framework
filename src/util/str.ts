import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique id.
 */
function generateUniqueId(): string {
  return uuidv4();
}

/**
 * Slugify string.
 */
function slugify({ text }: { text: string }): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

/**
 * Make text title case.
 */
function titleCase({ text }: { text: string }): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Remove file extension from filename.
 */
function removeFileExtension({ filename }: { filename: string }): string {
  return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Get file extension from filename.
 * @param filename
 * @returns File extension
 */
function getFileExtension({ filename }: { filename: string }): string {
  return filename.split('.').pop() ?? '';
}

export default {
  generateUniqueId,
  slugify,
  titleCase,
  removeFileExtension,
  getFileExtension,
};
