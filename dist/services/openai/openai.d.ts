import { OpenAIConstructorOptions } from './openai.interface.js';
export default class {
    private client;
    private options;
    constructor(options: Partial<OpenAIConstructorOptions>);
    analyzeImage({ imageData, analyzerInstruction, textHistory, }: {
        imageData: string;
        analyzerInstruction: string;
        textHistory?: string[];
    }): Promise<{
        responseText: string;
    }>;
    private generateNewLine;
    private createReadStreamFromBase64;
    private bufferToStream;
    private processImage;
    private createTransparentImage;
    private base64ToFile;
}
//# sourceMappingURL=openai.d.ts.map