import { describe, it } from 'node:test';
import assert from 'node:assert';
import str from '../../../src/util/str.ts';

describe('String Utilities', () => {
  describe('generateUniqueId', () => {
    it('should generate a unique UUID', () => {
      const id1 = str.generateUniqueId();
      const id2 = str.generateUniqueId();

      assert.ok(id1);
      assert.ok(id2);
      assert.notEqual(id1, id2);
      assert.match(id1, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('slugify', () => {
    it('should convert text to slug format', () => {
      const result = str.slugify({ text: 'Hello World' });
      assert.strictEqual(result, 'hello-world');
    });

    it('should handle special characters', () => {
      const result = str.slugify({ text: 'Hello @#$% World!' });
      assert.strictEqual(result, 'hello-world');
    });

    it('should handle multiple spaces', () => {
      const result = str.slugify({ text: 'Hello    World' });
      assert.strictEqual(result, 'hello-world');
    });

    it('should trim dashes from start and end', () => {
      const result = str.slugify({ text: '  Hello World  ' });
      assert.strictEqual(result, 'hello-world');
    });

    it('should handle empty string', () => {
      const result = str.slugify({ text: '' });
      assert.strictEqual(result, '');
    });
  });

  describe('titleCase', () => {
    it('should convert text to title case', () => {
      const result = str.titleCase({ text: 'hello world' });
      assert.strictEqual(result, 'Hello World');
    });

    it('should handle mixed case input', () => {
      const result = str.titleCase({ text: 'hELLo WoRLD' });
      assert.strictEqual(result, 'Hello World');
    });

    it('should handle single word', () => {
      const result = str.titleCase({ text: 'hello' });
      assert.strictEqual(result, 'Hello');
    });

    it('should handle empty string', () => {
      const result = str.titleCase({ text: '' });
      assert.strictEqual(result, '');
    });
  });

  describe('removeFileExtension', () => {
    it('should remove file extension', () => {
      const result = str.removeFileExtension({ filename: 'test.txt' });
      assert.strictEqual(result, 'test');
    });

    it('should handle multiple extensions', () => {
      const result = str.removeFileExtension({ filename: 'test.backup.txt' });
      assert.strictEqual(result, 'test.backup');
    });

    it('should handle files without extension', () => {
      const result = str.removeFileExtension({ filename: 'test' });
      assert.strictEqual(result, 'test');
    });

    it('should handle hidden files', () => {
      const result = str.removeFileExtension({ filename: '.gitignore' });
      assert.strictEqual(result, '');
    });
  });

  describe('getFileExtension', () => {
    it('should get file extension', () => {
      const result = str.getFileExtension({ filename: 'test.txt' });
      assert.strictEqual(result, 'txt');
    });

    it('should get last extension for multiple extensions', () => {
      const result = str.getFileExtension({ filename: 'test.backup.txt' });
      assert.strictEqual(result, 'txt');
    });

    it('should return filename when no extension exists', () => {
      const result = str.getFileExtension({ filename: 'test' });
      assert.strictEqual(result, 'test');
    });

    it('should handle hidden files', () => {
      const result = str.getFileExtension({ filename: '.gitignore' });
      assert.strictEqual(result, 'gitignore');
    });

    it('should handle hidden files with extension', () => {
      const result = str.getFileExtension({ filename: '.env.local' });
      assert.strictEqual(result, 'local');
    });
  });
});
