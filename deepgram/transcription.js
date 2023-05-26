require('dotenv').config();
const { Deepgram } = require("@deepgram/sdk");
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

const deepgram = new Deepgram(deepgramApiKey);

const transcribe = async (audioBuffer, mimetype) => {
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
}

exports.transcribe = transcribe;