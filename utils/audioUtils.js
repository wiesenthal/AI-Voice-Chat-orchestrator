import { transcribe } from "../services/deepgramTranscription.js";
import { FileWriter } from 'wav';
import { readFileSync, unlink, existsSync } from 'fs';

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
        // check if fileWriter is already ended
        if (fileWriter._writableState.finished) {
            console.log('Tried to write to fileWriter, fileWriter already ended');
            return;
        }

        if (!existsSync(fileWriter.path)) {
            console.log('Tried to write to fileWriter, fileWriter path does not exist');
            // print stack trace
            console.trace();
            return;
        }

        fileWriter.write(Buffer.from(audioData));
    }
    catch (err) {
        console.log(`Error writing to file: ${err}`);
    }
}

export function endFileWriter(fileWriter) {
    try {
        if (fileWriter === null) {
            console.log('Tried to end fileWriter, FileWriter is null');
            return;
        }
        // check if fileWriter is already ended
        if (fileWriter._writableState.finished) {
            console.log('Tried to end fileWriter, fileWriter already ended');
            return;
        }
        fileWriter.end();
    }
    catch (err) {
        console.warn(`Error ending fileWriter: ${err}`);
    }
}

export function tryDeleteFile(filename, fileWriter) {
    try {
        endFileWriter(fileWriter);
        
        // delete file in 0.5 seconds
        setTimeout(() => {
            unlink(filename, (err) => {
                if (err) {
                    console.warn(`Error deleting file ${filename}: ${err}`);
                }
            });
        }, 500);
    }
    catch (err) {
        console.warn(`Error deleting file ${filename}: ${err}`);
    }
}