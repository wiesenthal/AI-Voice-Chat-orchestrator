import { transcribe } from "../services/deepgramTranscription.js";
import { FileWriter } from 'wav';
import { readFileSync, unlink } from 'fs';

export async function transcribeAudioFile(filename) {
    const { audio, mimetype } = readAudioFile(filename);

    const transcript = await transcribe(audio, mimetype);

    return transcript;
}

export function readAudioFile(filename) {
    const audio = readFileSync(filename);
    const mimetype = "audio/x-wav;codec=pcm;rate=16000";
    return { audio, mimetype };
}

export function initializeAudioFile(commandID) {
    const filename = `audioFiles/${commandID}.wav`;
    const  fileWriter = new FileWriter(filename, {
        channels: 1,
        sampleRate: 16000,
        bitDepth: 16,
    });

    return { filename, fileWriter };
}

export function writeToAudioFile(fileWriter, audioData) {
    try {
        fileWriter.write(Buffer.from(audioData));
    }
    catch (err) {
        console.log(`Error writing to file: ${err}`);
    }
}

export function endFileWriter(fileWriter) {
    try {
        fileWriter.end();
    }
    catch (err) {
        console.warn(`Error ending fileWriter: ${err}`);
    }
}

export function tryDeleteFile(filename) {
    try {
        unlink(filename, (err) => {
            if (err) {
                console.warn(`Error deleting file ${filename}: ${err}`);
            }
        });
    }
    catch (err) {
        console.warn(`Error deleting file ${filename}: ${err}`);
    }
}