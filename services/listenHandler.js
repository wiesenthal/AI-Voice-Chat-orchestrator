import { writeToAudioFile } from '../utils/audioUtils.js';

export function streamAudioToFile(socket, fileWriter) {
    // we need to return a function that can be used to remove the listener

    const streamAudio = async (audioData) => {
        writeToAudioFile(fileWriter, audioData);
    }

    console.log('Adding streamAudio listener');
    socket.on('streamAudio', streamAudio);

    return () => {
        console.log('Removing streamAudio listener');
        socket.off('streamAudio', streamAudio);
    }
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