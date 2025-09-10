import { describe, it, expect } from 'vitest';
import URL from '../../../src/util/url.js';

describe('URL', () => {
  describe('buildQueryString', () => {
    it('should build query string from object', () => {
      const params = { name: 'John', age: 30, active: true };
      const result = URL.buildQueryString(params);
      expect(result).toBe('name=John&age=30&active=true');
    });

    it('should handle empty object', () => {
      const result = URL.buildQueryString({});
      expect(result).toBe('');
    });

    it('should filter out undefined values', () => {
      const params = { name: 'John', age: undefined, city: 'NY' };
      const result = URL.buildQueryString(params as any);
      expect(result).toBe('name=John&city=NY');
    });

    it('should filter out empty string values', () => {
      const params = { name: 'John', description: '', city: 'NY' };
      const result = URL.buildQueryString(params);
      expect(result).toBe('name=John&city=NY');
    });

    it('should encode special characters', () => {
      const params = { search: 'hello world', email: 'test@example.com' };
      const result = URL.buildQueryString(params);
      expect(result).toBe('search=hello%20world&email=test%40example.com');
    });

    it('should handle numeric values', () => {
      const params = { page: 1, limit: 50, offset: 0 };
      const result = URL.buildQueryString(params);
      expect(result).toBe('page=1&limit=50&offset=0');
    });

    it('should handle boolean values', () => {
      const params = { active: true, verified: false };
      const result = URL.buildQueryString(params);
      expect(result).toBe('active=true&verified=false');
    });

    it('should handle mixed types', () => {
      const params = {
        name: 'John Doe',
        age: 25,
        active: true,
        role: '',
      };
      const result = URL.buildQueryString(params);
      expect(result).toBe('name=John%20Doe&age=25&active=true');
    });

    it('should handle special characters requiring encoding', () => {
      const params = {
        query: '100% natural',
        category: 'food & beverages',
        tags: 'organic,local',
      };
      const result = URL.buildQueryString(params);
      expect(result).toBe('query=100%25%20natural&category=food%20%26%20beverages&tags=organic%2Clocal');
    });

    it('should handle unicode characters', () => {
      const params = {
        title: 'café',
        description: '测试',
      };
      const result = URL.buildQueryString(params);
      expect(result).toBe('title=caf%C3%A9&description=%E6%B5%8B%E8%AF%95');
    });
  });
});
