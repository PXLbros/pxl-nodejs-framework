import os from 'os';
import crypto from 'crypto';
function getUniqueComputerId() {
    const networkInterfaces = os.networkInterfaces();
    let macAddress = '';
    for (const key in networkInterfaces) {
        const networkInterface = networkInterfaces[key];
        if (networkInterface) {
            for (const interfaceDetails of networkInterface) {
                if (interfaceDetails.mac) {
                    macAddress = interfaceDetails.mac;
                    break;
                }
            }
        }
        if (macAddress) {
            break;
        }
    }
    const uniqueComputerId = crypto.createHash('sha256').update(macAddress).digest('hex');
    return uniqueComputerId;
}
export default {
    getUniqueComputerId,
};
//# sourceMappingURL=os.js.map