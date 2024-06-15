import OpenAI from 'openai';
// import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import sharp from 'sharp';
// import { ImagesResponse } from 'openai/resources';
import { Readable } from 'stream';
// import { formatSize } from '../utils/file';
import { tmpdir } from 'os';
import { join } from 'path';
import { Logger } from '../../logger/index.js';
import { Helper } from '../../util/index.js';
import { OpenAIConstructorOptions } from './openai.interface.js';

export default class {
  private client: OpenAI;

  private options: OpenAIConstructorOptions;

  constructor(options: Partial<OpenAIConstructorOptions>) {
    // Define default options
    const defaultOptions: Partial<OpenAIConstructorOptions> = {};

    this.options = Helper.defaultsDeep(options, defaultOptions);
    // const apiKey = process.env['OPENAI_API_KEY'];
    // const apiKey = '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';

    if (!this.options.apiKey) {
      throw new Error('OpenAI API key not set');
    }

    this.client = new OpenAI({
      apiKey: this.options.apiKey,
    });
  }

  public async analyzeImage({
    imageData,
    analyzerInstruction,
    textHistory,
  }: {
    imageData: string;
    analyzerInstruction: string;
    textHistory?: string[];
  }): Promise<{ responseText: string }> {
    textHistory = textHistory || [];

    const chatParams = {
      messages: [
        {
          role: 'system',
          content: analyzerInstruction,
        },
        ...this.generateNewLine({ base64Image: imageData }),
      ],
      model: 'gpt-4o', // 'gpt-4-turbo',
      max_tokens: 500,
    };

    if (textHistory.length > 0) {
      chatParams.messages.push({
        role: 'assistant',
        content: textHistory.map((textHistoryItem: any) => {
          return `Don't start the sentence with, or sound similar to: ${textHistoryItem.text}`;
        }),
      });
    }

    try {
      const chatCompletion = await this.client.chat.completions.create(chatParams);

      if (!chatCompletion?.choices?.length) {
        throw new Error('Chat completion not found');
      }

      // response_text = response.choices[0].message.content

      // console.log(JSON.stringify(chatCompletion.choices, null, 2));

      // Extract response text
      const responseText = chatCompletion.choices[0].message.content;

      if (!responseText) {
        throw new Error('Response text not found');
      }

      Logger.info('OpenAI response', {
        'Response Text': responseText,
      });

      return {
        responseText,
      };
    } catch (error: unknown) {
      Logger.error(error);

      throw error;
    }
  }

  private generateNewLine({ base64Image }: { base64Image: string }): any[] {
    return [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image' },
          {
            type: 'image_url',
            image_url: {
              url: base64Image,
              detail: 'low',
            },
          },
        ],
      },
    ];
  }

  private createReadStreamFromBase64(base64String: string): Readable {
    const bufferData = Buffer.from(base64String, 'base64');

    const readableStream = new Readable({
      read() {
        this.push(bufferData);
        this.push(null);
      },
    });

    return readableStream;
  }

  private async bufferToStream(buffer: Buffer): Promise<Readable> {
    const readable = new Readable();
    readable._read = () => {}; // _read is required but you can noop it
    readable.push(buffer);
    readable.push(null);
    return readable;
  }

  private async processImage(base64String: string): Promise<string> {
    const tempDir = tmpdir();
    const tempFileName = `image-${Date.now()}.png`;
    const tempFilePath = join(tempDir, tempFileName);

    // Decode Base64 string, removing any MIME type prefix if present
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Use sharp to validate and process the image
    try {
      await sharp(buffer)
        .ensureAlpha()
        .resize(512, 512) // Ensure the image is resized to avoid exceeding size limits
        .toFormat('png')
        .toFile(tempFilePath);

      return tempFilePath;
    } catch (error) {
      console.error('Error processing image with Sharp:', error);
      throw new Error('Failed to process image data.');
    }
  }

  private async createTransparentImage(): Promise<string> {
    const tempDir = tmpdir();
    const tempFileName = `transparent-image-${Date.now()}.png`;
    const tempFilePath = join(tempDir, tempFileName);

    // Create a transparent image
    const image = sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });

    await image.toFile(tempFilePath);

    return tempFilePath;
  }

  private async base64ToFile(base64String: string, outputPath: string): Promise<string> {
    const buffer = Buffer.from(base64String, 'base64');
    await fs.writeFile(outputPath, buffer);
    return outputPath;
  }

  // public async generateImage({ inputImageData, prompt }: { inputImageData?: string; prompt: string }): Promise<string> {
  //   const model = 'gpt-4o'; // 'dall-e-3';
  //   const numImagesToGenerate = 1;
  //   const size = '1024x1024';
  //   const quality = 'standard'; // or 'hd',

  //   try {
  //     let response: ImagesResponse;

  //     // Add prefix to prompt for closer results (OpenAI specific)
  //     prompt = `I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS: ${prompt}`;

  //     if (inputImageData) {
  //       const filePath = await this.processImage(inputImageData);
  //       const imageStream = createReadStream(filePath);
  //       const maskFilePath = await this.createTransparentImage();
  //       const maskImageStream = createReadStream(maskFilePath);

  //       // response = await this.client.images.createVariation({
  //       //   n: numImagesToGenerate,
  //       //   size,
  //       //   image: imageStream,
  //       // });

  //       response = await this.client.images.edit({
  //         n: numImagesToGenerate,
  //         image: imageStream,
  //         mask: maskImageStream,
  //         size,
  //         prompt,
  //       });
  //     } else {
  //       response = await this.client.images.generate({
  //         model,
  //         prompt,
  //         n: numImagesToGenerate,
  //         size,
  //         quality,
  //       });
  //     }

  //     console.log('image generation response', response);

  //     const generatedImageUrl = response.data[0].url;

  //     if (!generatedImageUrl) {
  //       throw new Error('Generated image URL not found');
  //     }

  //     return generatedImageUrl;
  //   } catch (error) {
  //     Logger.error(error);

  //     throw error;
  //   }
  // }
}
