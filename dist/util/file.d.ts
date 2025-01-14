declare function convertFile({ inputFilePath, outputFilePath, format, }: {
    inputFilePath: string;
    outputFilePath: string;
    format: string;
}): Promise<void>;
/**
 * Copy a file or directory synchronously
 *
 * @param src The source path
 * @param dest The destination path
 */
declare function copySync(src: string, dest: string): void;
/**
 * Download file from URL
 *
 * @param url The URL to download the file from
 * @param destinationPath The path to save the downloaded file
 */
declare function downloadFile({ url, destinationPath, }: {
    url: string;
    destinationPath: string;
}): Promise<void>;
/**
 * Format file size.
 *
 * @param bytes The file size in bytes
 */
declare function formatFileSize({ bytes, }: {
    bytes: number;
}): string;
/**
 * Remove a file or directory synchronously
 *
 * @param target The path to the file or directory to remove
 */
declare function removeSync(target: string): void;
declare const _default: {
    convertFile: typeof convertFile;
    copySync: typeof copySync;
    downloadFile: typeof downloadFile;
    formatFileSize: typeof formatFileSize;
    removeSync: typeof removeSync;
};
export default _default;
//# sourceMappingURL=file.d.ts.map