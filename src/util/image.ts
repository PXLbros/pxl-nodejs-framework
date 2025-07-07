function extractMimeType({ base64 }: { base64: string }): string | undefined {
  const match = base64.match(/^data:(.*?);base64,/);

  if (match && match.length > 1) {
    return match[1];
  } else {
    return undefined;
  }
}

function mimeTypeToExtension({
  mimeType,
}: {
  mimeType: string;
}): string | undefined {
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

export default {
  extractMimeType,
  mimeTypeToExtension,
};
