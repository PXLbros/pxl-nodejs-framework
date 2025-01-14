import { ElevenLabsConstructorOptions } from './elevenlabs.interface.js';
export default class {
    private voice;
    private options;
    constructor(options: Partial<ElevenLabsConstructorOptions>);
    textToSpeechStream({ text, voiceId }: {
        text: string;
        voiceId: string;
    }): Promise<Buffer>;
}
//# sourceMappingURL=elevenlabs.d.ts.map