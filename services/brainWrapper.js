import { request as _request } from 'http';
import dotenv from 'dotenv';
dotenv.config();

const brainRunningLocally = process.env.BRAIN_RUNNING_LOCALLY;
const brainHostname = process.env.BRAIN_HOSTNAME;

export async function* sendTextToGPT(transcript, userID, commandID) {
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

export function sendCancelToBrain(userID, commandID) {
    // post a cancel message to the brain
    let options = {
        hostname: 'localhost',
        port: 2000,
        path: '/cancelCommand',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (!brainRunningLocally) {
        options = {
            hostname: brainHostname,
            path: '/cancelCommand',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        };
    }

    const request = _request(options, (response) => {
        console.log('Cancel request sent to brain');
    });

    request.on('error', (error) => {
        console.error('Error when calling brain server:', error);
    });

    console.log(`Sending cancel request to brain with userID: ${userID} and commandID: ${commandID}`);
    request.write(JSON.stringify({ userID: userID, commandID: commandID }));
    request.end();
}

export function sendDisconnectToBrain(userID) {
    // post a cancel message to the brain
    let options = {
        hostname: 'localhost',
        port: 2000,
        path: '/disconnect',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (!brainRunningLocally) {
        options = {
            hostname: brainHostname,
            path: '/disconnect',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        };
    }

    const request = _request(options, (response) => {
        console.log('Disconnect request sent to brain');
    });

    request.on('error', (error) => {
        console.error('Error when calling brain server:', error);
    });

    request.write(JSON.stringify({ userID: userID }));
    request.end();
}