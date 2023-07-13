import { writeToAudioFile } from '../utils/audioUtils.js';

export function streamAudioToFile(socket, fileWriter) {
    socket.on('streamAudio', async (audioData) => {
        writeToAudioFile(fileWriter, audioData);
    });
}

export async function onAudioComplete(socket, timeout = 500000) {
    console.log('Waiting for endListen event');
    // returns a promise that resolves when the socket receives a endListen event
    return new Promise((resolve, reject) => {
        socket.on('endListen', () => {
            console.log('Received endListen event');
            resolve();
        });
        setTimeout(() => {
            reject(`Timeout of ${timeout}ms exceeded, no endListen event received`);
        }
            , timeout);
    });
}