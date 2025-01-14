/**
 * Generate a unique id.
 */
declare function generateUniqueId(): string;
/**
 * Slugify string.
 */
declare function slugify({ text }: {
    text: string;
}): string;
/**
 * Make text title case.
 */
declare function titleCase({ text }: {
    text: string;
}): string;
/**
 * Remove file extension from filename.
 */
declare function removeFileExtension({ filename }: {
    filename: string;
}): string;
declare const _default: {
    generateUniqueId: typeof generateUniqueId;
    slugify: typeof slugify;
    titleCase: typeof titleCase;
    removeFileExtension: typeof removeFileExtension;
};
export default _default;
//# sourceMappingURL=str.d.ts.map