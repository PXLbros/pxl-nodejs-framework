import crypto from 'node:crypto';
import os from 'node:os';

function getUniqueComputerId(): string {
  const interfaces = Object.values(os.networkInterfaces()).filter(Boolean) as os.NetworkInterfaceInfo[][];
  let macAddress = '';
  for (const ifaceList of interfaces) {
    for (const details of ifaceList) {
      if (details.mac) {
        macAddress = details.mac;
        break;
      }
    }
    if (macAddress) break;
  }
  return crypto.createHash('sha256').update(macAddress).digest('hex');
}

export default {
  getUniqueComputerId,
};
