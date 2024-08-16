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
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

export default {
  generateUniqueId,
  slugify,
};
