import { describe, it, expect, vi } from 'vitest';
import os from 'os';
import crypto from 'crypto';
import OS from '../../../src/util/os.js';

// Mock os and crypto modules
vi.mock('os');
vi.mock('crypto');

describe('OS', () => {
  describe('getUniqueComputerId', () => {
    it('should generate unique computer ID from MAC address', () => {
      // Mock network interfaces
      const mockNetworkInterfaces = {
        eth0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '00:11:22:33:44:55',
            internal: false,
            cidr: '192.168.1.100/24'
          }
        ]
      };

      // Mock crypto hash
      const mockHash = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('mocked-hash-value')
      };

      vi.mocked(os.networkInterfaces).mockReturnValue(mockNetworkInterfaces);
      vi.mocked(crypto.createHash).mockReturnValue(mockHash as any);

      const result = OS.getUniqueComputerId();

      expect(os.networkInterfaces).toHaveBeenCalled();
      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
      expect(mockHash.update).toHaveBeenCalledWith('00:11:22:33:44:55');
      expect(mockHash.digest).toHaveBeenCalledWith('hex');
      expect(result).toBe('mocked-hash-value');
    });

    it('should handle multiple network interfaces and pick first MAC', () => {
      const mockNetworkInterfaces = {
        lo: [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8'
          }
        ],
        eth0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: 'aa:bb:cc:dd:ee:ff',
            internal: false,
            cidr: '192.168.1.100/24'
          }
        ],
        wlan0: [
          {
            address: '192.168.1.101',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '11:22:33:44:55:66',
            internal: false,
            cidr: '192.168.1.101/24'
          }
        ]
      };

      const mockHash = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash-from-first-mac')
      };

      vi.mocked(os.networkInterfaces).mockReturnValue(mockNetworkInterfaces);
      vi.mocked(crypto.createHash).mockReturnValue(mockHash as any);

      const result = OS.getUniqueComputerId();

      // Should use the first interface with a MAC address
      expect(mockHash.update).toHaveBeenCalledWith('00:00:00:00:00:00');
      expect(result).toBe('hash-from-first-mac');
    });

    it('should handle interfaces with no MAC address', () => {
      const mockNetworkInterfaces = {
        tun0: [
          {
            address: '10.0.0.1',
            netmask: '255.255.255.0',
            family: 'IPv4',
            internal: false,
            cidr: '10.0.0.1/24'
            // No mac property
          }
        ],
        eth0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: 'valid-mac-address',
            internal: false,
            cidr: '192.168.1.100/24'
          }
        ]
      };

      const mockHash = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash-from-valid-mac')
      };

      vi.mocked(os.networkInterfaces).mockReturnValue(mockNetworkInterfaces);
      vi.mocked(crypto.createHash).mockReturnValue(mockHash as any);

      const result = OS.getUniqueComputerId();

      // Should skip interfaces without MAC and use the valid one
      expect(mockHash.update).toHaveBeenCalledWith('valid-mac-address');
      expect(result).toBe('hash-from-valid-mac');
    });

    it('should handle empty network interfaces', () => {
      const mockNetworkInterfaces = {};

      const mockHash = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash-from-empty-mac')
      };

      vi.mocked(os.networkInterfaces).mockReturnValue(mockNetworkInterfaces);
      vi.mocked(crypto.createHash).mockReturnValue(mockHash as any);

      const result = OS.getUniqueComputerId();

      // Should hash empty string when no MAC addresses found
      expect(mockHash.update).toHaveBeenCalledWith('');
      expect(result).toBe('hash-from-empty-mac');
    });

    it('should handle null network interface details', () => {
      const mockNetworkInterfaces = {
        eth0: null
      };

      const mockHash = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('hash-from-null-interface')
      };

      vi.mocked(os.networkInterfaces).mockReturnValue(mockNetworkInterfaces as any);
      vi.mocked(crypto.createHash).mockReturnValue(mockHash as any);

      const result = OS.getUniqueComputerId();

      expect(mockHash.update).toHaveBeenCalledWith('');
      expect(result).toBe('hash-from-null-interface');
    });
  });
});