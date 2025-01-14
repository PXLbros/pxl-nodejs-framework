function extractMimeType({ base64 }) {
    const match = base64.match(/^data:(.*?);base64,/);
    if (match && match.length > 1) {
        return match[1];
    }
    else {
        return undefined;
    }
}
;
function mimeTypeToExtension({ mimeType }) {
    switch (mimeType) {
        case 'image/jpeg': {
            return 'jpg';
        }
        case 'image/png': {
            return 'png';
        }
        case 'image/webp': {
            return 'webp';
        }
        default: {
            return undefined;
        }
    }
}
;
export default {
    extractMimeType,
    mimeTypeToExtension,
};
//# sourceMappingURL=image.js.map