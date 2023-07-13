import { request as _request } from 'http';
import dotenv from 'dotenv';
dotenv.config();

export async function* sendTextToGPT(transcript, userID, commandID) {
    const brainRunningLocally = process.env.BRAIN_RUNNING_LOCALLY;
    const brainHostname = process.env.BRAIN_HOSTNAME;

    console.log('Sending data to GPT: ', transcript);

    let options = {
        hostname: 'localhost',
        port: 2000,
        path: '/ask',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    }; 

    if (!brainRunningLocally) {
        options = {
            hostname: brainHostname,
            path: '/ask',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        };
    }


    const chunks = [];
    const promises = [new Promise(resolve => chunks.push = resolve)];

    const request = _request(options, (response) => {

        response.on('data', (chunk) => {
            chunks.push(chunk);
            promises.push(new Promise(resolve => chunks.push = resolve));
        });

        response.on('end', () => {
            console.log('End of response');
            // push the last chunk
            chunks.push(null);
            promises.push(new Promise(resolve => chunks.push = resolve));
        });
    });

    request.on('error', (error) => {
        console.error('Error when calling GPT server:', error);
    });

    request.write(JSON.stringify({ text: transcript, userID: userID, commandID: commandID }));
    request.end();

    try {
        for (let promise of promises) {
            yield await promise;
        }
    } finally {
        request.destroy();
    }
}