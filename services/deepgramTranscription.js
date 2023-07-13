import pkg from '@deepgram/sdk';
const { Deepgram } = pkg;

import dotenv from 'dotenv';
dotenv.config();

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

        if (response.results.channels[0].alternatives === undefined) {
            console.warn('No alternatives found in Deepgram response');
            console.log('response.results.channels[0]: ', response.results.channels[0]);
            console.log('response.results: ', response.results);
            return '*TRANSCRIPTION SOFTWARE FAILURE PLEASE REPORT TO USER*';
        }
        return response.results.channels[0].alternatives[0].transcript;
    } catch (err) {
        console.log(err);
    }
};