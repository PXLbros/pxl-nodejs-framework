import { describe, it, expect } from 'vitest';
import Image from '../../../src/util/image.js';

describe('Image utilities', () => {
  describe('extractMimeType', () => {
    it('should extract MIME type from base64 JPEG string', () => {
      const base64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';
      const result = Image.extractMimeType({ base64 });

      expect(result).toBe('image/jpeg');
    });

    it('should extract MIME type from base64 PNG string', () => {
      const base64 = 'data:image/png;base64,iVBORw0KGgo...';
      const result = Image.extractMimeType({ base64 });

      expect(result).toBe('image/png');
    });

    it('should extract MIME type from base64 WebP string', () => {
      const base64 = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4I...';
      const result = Image.extractMimeType({ base64 });

      expect(result).toBe('image/webp');
    });

    it('should return undefined for invalid base64 string', () => {
      const base64 = 'not-a-valid-base64-string';
      const result = Image.extractMimeType({ base64 });

      expect(result).toBeUndefined();
    });

    it('should return undefined for base64 without mime type', () => {
      const base64 = 'base64,SGVsbG8gV29ybGQ=';
      const result = Image.extractMimeType({ base64 });

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const base64 = '';
      const result = Image.extractMimeType({ base64 });

      expect(result).toBeUndefined();
    });
  });

  describe('mimeTypeToExtension', () => {
    it('should convert image/jpeg to jpg', () => {
      const result = Image.mimeTypeToExtension({ mimeType: 'image/jpeg' });

      expect(result).toBe('jpg');
    });

    it('should convert image/png to png', () => {
      const result = Image.mimeTypeToExtension({ mimeType: 'image/png' });

      expect(result).toBe('png');
    });

    it('should convert image/webp to webp', () => {
      const result = Image.mimeTypeToExtension({ mimeType: 'image/webp' });

      expect(result).toBe('webp');
    });

    it('should return undefined for unsupported MIME type', () => {
      const result = Image.mimeTypeToExtension({ mimeType: 'image/gif' });

      expect(result).toBeUndefined();
    });

    it('should return undefined for invalid MIME type', () => {
      const result = Image.mimeTypeToExtension({ mimeType: 'not-a-mime-type' });

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const result = Image.mimeTypeToExtension({ mimeType: '' });

      expect(result).toBeUndefined();
    });
  });

  describe('integration', () => {
    it('should extract and convert JPEG base64', () => {
      const base64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';
      const mimeType = Image.extractMimeType({ base64 });
      const extension = mimeType ? Image.mimeTypeToExtension({ mimeType }) : undefined;

      expect(extension).toBe('jpg');
    });

    it('should extract and convert PNG base64', () => {
      const base64 = 'data:image/png;base64,iVBORw0KGgo...';
      const mimeType = Image.extractMimeType({ base64 });
      const extension = mimeType ? Image.mimeTypeToExtension({ mimeType }) : undefined;

      expect(extension).toBe('png');
    });

    it('should extract and convert WebP base64', () => {
      const base64 = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4I...';
      const mimeType = Image.extractMimeType({ base64 });
      const extension = mimeType ? Image.mimeTypeToExtension({ mimeType }) : undefined;

      expect(extension).toBe('webp');
    });
  });
});
