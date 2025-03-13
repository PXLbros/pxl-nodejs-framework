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
export default class {
    client;
    options;
    constructor(options) {
        // Define default options
        const defaultOptions = {};
        this.options = Helper.defaultsDeep(options, defaultOptions);
        if (!this.options.apiKey) {
            throw new Error('OpenAI API key not set');
        }
        this.client = new OpenAI({
            apiKey: this.options.apiKey,
        });
    }
    async analyzeImage({ imageData, analyzerInstruction, textHistory, }) {
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
                content: textHistory.map((textHistoryItem) => {
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
        }
        catch (error) {
            Logger.error(error);
            throw error;
        }
    }
    generateNewLine({ base64Image }) {
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
    createReadStreamFromBase64(base64String) {
        const bufferData = Buffer.from(base64String, 'base64');
        const readableStream = new Readable({
            read() {
                this.push(bufferData);
                this.push(null);
            },
        });
        return readableStream;
    }
    async bufferToStream(buffer) {
        const readable = new Readable();
        readable._read = () => { }; // _read is required but you can noop it
        readable.push(buffer);
        readable.push(null);
        return readable;
    }
    async processImage(base64String) {
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
        }
        catch (error) {
            console.error('Error processing image with Sharp:', error);
            throw new Error('Failed to process image data.');
        }
    }
    async createTransparentImage() {
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
    async base64ToFile(base64String, outputPath) {
        const buffer = Buffer.from(base64String, 'base64');
        await fs.writeFile(outputPath, buffer);
        return outputPath;
    }
}
//# sourceMappingURL=openai.js.map