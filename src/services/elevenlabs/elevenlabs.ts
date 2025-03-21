// @ts-expect-error
import ElevenLabs from 'elevenlabs-node';
// import { AxiosError } from 'axios';
import { Logger } from '../../logger/index.js';
import { Helper } from '../../util/index.js';
import { ElevenLabsConstructorOptions } from './elevenlabs.interface.js';

export default class {
  private voice;

  private options: ElevenLabsConstructorOptions;

  constructor(options: Partial<ElevenLabsConstructorOptions>) {
    // Define default options
    const defaultOptions: Partial<ElevenLabsConstructorOptions> = {};

    this.options = Helper.defaultsDeep(options, defaultOptions);

    if (!this.options.apiKey) {
      throw new Error('No OpenAI API key not set');
    }

    this.voice = new ElevenLabs({
      apiKey: this.options.apiKey,
    });
  }

  // public async textToSpeech({ text }: { text: string }): Promise<void> {
  //   console.log('textToSpeech: ', text);

  //   try {
  //     // Generate audio filename with timestamp included
  //     const audioFileName = `audio-${Date.now()}.mp3`;

  //     this.voice
  //       .textToSpeech({
  //         // Required Parameters
  //         fileName: audioFileName, // The name of your audio file
  //         textInput: text, // The text you wish to convert to speech

  //         // Optional Parameters
  //         voiceId: 'GhhSRwKN7Fay1w7B6hTR', // A different Voice ID from the default
  //         stability: 0.5, // The stability for the converted speech
  //         similarityBoost: 0.5, // The similarity boost for the converted speech
  //         modelId: 'eleven_multilingual_v2', // The ElevenLabs Model ID
  //         style: 1, // The style exaggeration for the converted speech
  //         speakerBoost: true, // The speaker boost for the converted speech
  //       })
  //       .then((elevenlabsResponse: any) => {
  //         console.log('--------- elevenlabsResponse', elevenlabsResponse);
  //       });
  //   } catch (error: unknown) {
  //     logger.error(error);

  //     throw error;
  //   }
  // }

  public async textToSpeechStream({ text, voiceId }: { text: string, voiceId: string }): Promise<Buffer> {
    if (!text) {
      throw new Error('Text is required');
    } else if (!voiceId) {
      throw new Error('Voice ID is required');
    }

    const stream: NodeJS.ReadableStream = await this.voice.textToSpeechStream({
      textInput: text, // The text you wish to convert to speech

      // Optional Parameters
      voiceId, // A different Voice ID from the default

      // Stability:
      // The stability slider determines how stable the voice is and the randomness between each generation
      // Lowering this slider introduces a broader emotional range for the voice.
      stability: 0.8, // The stability for the converted speech

      // Similarity:
      // The similarity slider dictates how closely the AI should adhere to the original voice when attempting to replicate it.
      // If the original audio is of poor quality and the similarity slider is set too high,
      // the AI may reproduce artifacts or background noise when trying to mimic the voice if those were present in the original recording.
      similarityBoost: 1,

      modelId: 'eleven_turbo_v2', // 'eleven_multilingual_v2', // The ElevenLabs Model ID // Test eleven_turbo_v2

      // It does consume additional computational resources and might increase latency if set to anything other than 0
      // In general, we recommend keeping this setting at 0 at all times.
      style: 0, // The style exaggeration for the converted speech

      // Boosts the similarity to the original speaker
      speakerBoost: true, // The speaker boost for the converted speech
    });

    return new Promise((resolve, reject) => {
      if (!stream) {
        reject(new Error('Could not get stream from text-to-speech engine'));

        return;
      }

      try {
        const chunks: Buffer[] = []; // Array to hold data chunks

        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk); // Append each chunk to the array
        });

        stream.on('end', () => {
          const fullBuffer = Buffer.concat(chunks); // Concatenate all chunks into a single Buffer
          resolve(fullBuffer); // Resolve the promise with the full buffer
        });

        stream.on('error', (error: Error) => {
          Logger.error(error);

          reject(error); // Reject the promise on error
        });
      } catch (error: unknown) {
        Logger.error(error);

        reject(error);
      }
    });
  }

  // private onStreamError = (error: Error) => {
  //   logger.error(error);
  // };

  // private onStreamData = (chunk: Buffer) => {
  //   const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;

  //   console.log('Stream data:', buffer);
  // };

  // private onStreamEnd = () => {
  //   console.log('Stream end');
  // };

  // public static getVoiceId({ voiceId }: { voiceId: string }): string {
  //   switch (voiceId) {
  //     case 'david-attenborough': {
  //       return 'GhhSRwKN7Fay1w7B6hTR';
  //     }
  //     case 'sports-commentator': {
  //       return 'G6Zo8wVH54a4vdcVnOLF';
  //     }
  //     // case 'news-caster': {
  //     //   return 'G6Zo8wVH54a4vdcVnOLF';
  //     // }
  //     case 'witty-college-girl': {
  //       return '03pg93WwzxapbmWgjOns';
  //     }
  //     case 'dennis': {
  //       return 'W1Nfs8YBRoRMfIPWp2XS';
  //     }
  //     case 'harold': {
  //       return 'UlQzP061AqptrSLuYnFf';
  //     }
  //     default: {
  //       throw new Error('Voice ID not found');
  //     }
  //   }
  // }
}
