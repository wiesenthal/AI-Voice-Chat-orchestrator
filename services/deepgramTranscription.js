import dotenv from 'dotenv';
dotenv.config();
import pkg from '@deepgram/sdk';
const { Deepgram } = pkg;
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

const deepgram = new Deepgram(deepgramApiKey);

export const transcribe = async (audioBuffer, mimetype) => {
    try {
        const source = {
            buffer: audioBuffer,
            mimetype: mimetype,
        };

        const response = await deepgram.transcription.preRecorded(source, {
            punctuate: true,
            model: "nova",
        });

        return response.results.channels[0].alternatives[0].transcript;
    } catch (err) {
        console.log(err);
    }
};