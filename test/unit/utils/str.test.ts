import { describe, it, expect } from 'vitest'
import str from '../../../src/util/str.js'

describe('String Utilities', () => {
  describe('generateUniqueId', () => {
    it('should generate a unique UUID', () => {
      const id1 = str.generateUniqueId()
      const id2 = str.generateUniqueId()
      
      expect(id1).toBeTruthy()
      expect(id2).toBeTruthy()
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })
  })

  describe('slugify', () => {
    it('should convert text to slug format', () => {
      const result = str.slugify({ text: 'Hello World' })
      expect(result).toBe('hello-world')
    })

    it('should handle special characters', () => {
      const result = str.slugify({ text: 'Hello @#$% World!' })
      expect(result).toBe('hello-world')
    })

    it('should handle multiple spaces', () => {
      const result = str.slugify({ text: 'Hello    World' })
      expect(result).toBe('hello-world')
    })

    it('should trim dashes from start and end', () => {
      const result = str.slugify({ text: '  Hello World  ' })
      expect(result).toBe('hello-world')
    })

    it('should handle empty string', () => {
      const result = str.slugify({ text: '' })
      expect(result).toBe('')
    })
  })

  describe('titleCase', () => {
    it('should convert text to title case', () => {
      const result = str.titleCase({ text: 'hello world' })
      expect(result).toBe('Hello World')
    })

    it('should handle mixed case input', () => {
      const result = str.titleCase({ text: 'hELLo WoRLD' })
      expect(result).toBe('Hello World')
    })

    it('should handle single word', () => {
      const result = str.titleCase({ text: 'hello' })
      expect(result).toBe('Hello')
    })

    it('should handle empty string', () => {
      const result = str.titleCase({ text: '' })
      expect(result).toBe('')
    })
  })

  describe('removeFileExtension', () => {
    it('should remove file extension', () => {
      const result = str.removeFileExtension({ filename: 'test.txt' })
      expect(result).toBe('test')
    })

    it('should handle multiple extensions', () => {
      const result = str.removeFileExtension({ filename: 'test.backup.txt' })
      expect(result).toBe('test.backup')
    })

    it('should handle files without extension', () => {
      const result = str.removeFileExtension({ filename: 'test' })
      expect(result).toBe('test')
    })

    it('should handle hidden files', () => {
      const result = str.removeFileExtension({ filename: '.gitignore' })
      expect(result).toBe('')
    })
  })

  describe('getFileExtension', () => {
    it('should get file extension', () => {
      const result = str.getFileExtension({ filename: 'test.txt' })
      expect(result).toBe('txt')
    })

    it('should get last extension for multiple extensions', () => {
      const result = str.getFileExtension({ filename: 'test.backup.txt' })
      expect(result).toBe('txt')
    })

    it('should return filename when no extension exists', () => {
      const result = str.getFileExtension({ filename: 'test' })
      expect(result).toBe('test')
    })

    it('should handle hidden files', () => {
      const result = str.getFileExtension({ filename: '.gitignore' })
      expect(result).toBe('gitignore')
    })

    it('should handle hidden files with extension', () => {
      const result = str.getFileExtension({ filename: '.env.local' })
      expect(result).toBe('local')
    })
  })
})