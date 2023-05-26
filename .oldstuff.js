// Connecting to transcription server
const transcriptionServerAddress = 'http://localhost:3000';
const socketIoClient = require('socket.io-client');
const VAD = require('node-vad');

const vad = new VAD(VAD.Mode.VERY_AGGRESSIVE, 16000, 100);

let silenceCounter = 0;
let voiceDetected = false;

let audioBuffer = []; // The buffer to store audio data
const bufferLength = 2; // The length of the buffer
let voiceCounter = 0; // The number of consecutive voice chunks

let abortCounter = 0;
let abortThreshold = 8;


const handleStartAudio = () => {
    console.log('Start of Audio for user:' + userID);

    transcriptionServer = socketIoClient(transcriptionServerAddress);

    // Receive transcript from transcription server and forward it to client
    transcriptionServer.on('transcript', (data) => {
        handleTranscript(data);
    });
    // Forward command to transcription server
    transcriptionServer.emit('startAudio');
}

const handleEndAudio = () => {
    console.log('End of Audio for user:' + userID);
    // Forward command to transcription server
    if (transcriptionServer) {
        transcriptionServer.emit('endAudio');
        transcriptionServer.disconnect();
        transcriptionServer = null;
    }
    else
        console.warn('Tried to end audio, but transcription server not connected');
}

let abortedText = '';
let shouldAbort = false;
let abortedAudioId = '';

let currentTranscript = '';
let currentTranscriptAudioId = '';
let previousTranscript = '';

const handleTranscript = async (data) => {
    // if new data is sent in, we need to be able to abort the gptPromise.
    // we should change how it works from that function to doing everything, instead it should
    // make the request and we can start streaming from it
    // then we can handle what we do with the response stream.
    // shouldAbort = true;        

    /*console.log("Should respond: ", shouldRespond(data));
    if (!shouldRespond(data)) {
        return;
    } */

    // shouldAbort = false;

    // if (abortedText !== '' && abortedAudioId !== data.audioId) {
    //     transcript = abortedText + "  " + data.transcript;
    //     console.log("Text was aborted, so new transcript is ", transcript);
    //     data.audioId = abortedAudioId;
    // } else {
    //     transcript = data.transcript;
    // }

    if (currentTranscriptAudioId == '') {
        console.log("No audio id");
        currentTranscriptAudioId = data.audioId;
    }

    transcript = data.transcript;

    if (currentTranscriptAudioId == data.audioId) {
        console.log(`Same audio id: ${currentTranscriptAudioId}, Previous transcript: ${previousTranscript}, Current transcript: ${currentTranscript}, New transcript: ${transcript}`);
        currentTranscript = transcript;
    }
    else {
        console.log(`Different audio id: ${currentTranscriptAudioId}, Previous transcript: ${previousTranscript}, Current transcript: ${currentTranscript}, New transcript: ${transcript}`);
        previousTranscript += currentTranscript;
        currentTranscript = transcript;
        currentTranscriptAudioId = data.audioId;
    }

    if (isListening || !shouldRespond(data)) {
        console.log(`Not responding; isListening: ${isListening}, shouldRespond: ${shouldRespond(data)}`)
        return;
    }

    const fullTranscript = previousTranscript + currentTranscript;
    previousTranscript = '';
    currentTranscript = '';
    currentTranscriptAudioId = '';
    console.log("Full transcript: ", fullTranscript);

    // message history of user with id data.audioId should be updated here
    // user_message_history.setMessage(role='user', id=data.audioId, content=fullTranscript);

    let words = "";
    let unread_words = "";

    for await (const word of sendTextToGPT(fullTranscript)) {
        words += word;
        unread_words += word;
        const formatted_words = {
            "words": words,
            "responseId": data.audioId
        }

        socket.emit('response', formatted_words);
        // message history should be updated here
        user_message_history.setMessage(role = 'assistant', id = data.audioId, content = words);
        if (shouldRead(unread_words)) {
            console.log("Should read: ", unread_words);
            // send unread_words to polly and we need to queue it to send to the client

            // we should monolithify Polly
            pollyQueue.enqueue({
                text: unread_words,
                voice: 'Amy',  // Set your preferred voice ID
                engine: 'standard',
                audioId: data.audioId  // Use the same audio ID as the transcript
            });

            unread_words = "";
        }
    }
}

const sendTextToGPT = async function* (transcript) {
    console.log('Sending data to GPT: ', transcript);

    const options = {
        hostname: 'localhost',
        port: 2000,
        path: '/ask',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const chunks = [];
    const promises = [new Promise(resolve => chunks.push = resolve)];

    const request = http.request(options, (response) => {

        response.on('data', (chunk) => {
            // if (shouldAbort) {
            //     abortedText += data.transcript;
            //     abortedAudioId = data.audioId;
            //     console.log('Aborting');
            //     request.destroy();
            //     shouldAbort = false;
            //     return;
            // }

            chunks.push(chunk);
            promises.push(new Promise(resolve => chunks.push = resolve));
        });

        response.on('end', () => {
            console.log('End of response');
            // now we should clear the aborted text
            // abortedText = '';
            // abortedAudioId = '';
        });
    });

    request.on('error', (error) => {
        console.error('Error when calling GPT server:', error);
    });

    console.log(`GPT formatted messages: ${JSON.stringify(user_message_history.getGPTFormattedMessages())}`)
    request.write(JSON.stringify({ text: transcript, message_history: user_message_history.getGPTFormattedMessages() }));
    request.end();

    try {
        for (let promise of promises) {
            yield await promise;
        }
    } finally {
        request.destroy();
    }
}

const handleStreamAudioDetection = (audioData) => {
    // Append the new chunk to the buffer
    audioBuffer.push(audioData);
    // If the buffer is too large, remove the oldest chunk
    if (audioBuffer.length > bufferLength) {
        audioBuffer.shift();
    }


    const maxSilenceCount = 30;
    const desiredSampleRate = 16000;

    vad.processAudio(audioData, desiredSampleRate).then(res => {
        switch (res) {
            case VAD.Event.ERROR:
                console.error("VAD Error", res);
                break;
            case VAD.Event.SILENCE:
                // console.log("VAD Silence");
                silenceCounter++;
                voiceCounter = 0;
                if (silenceCounter >= maxSilenceCount && voiceDetected) {
                    handleEndAudio();
                    voiceDetected = false;
                    silenceCounter = 0;
                }
                else if (transcriptionServer && voiceDetected) {
                    transcriptionServer.emit('streamAudio', audioData);
                }
                break;
            case VAD.Event.VOICE:
                // console.log("VAD Voice detected");
                voiceCounter++;
                abortCounter++;
                if (voiceCounter >= audioBuffer.length) {
                    voiceDetected = true;
                    silenceCounter = 0;
                }
                if (abortCounter >= abortThreshold) {

                    abortCounter = 0;
                    shouldAbort = true;
                }
                if (voiceDetected) {
                    if (!transcriptionServer) { // Added this block
                        handleStartAudio();
                        // Send all chunks in the buffer to the transcription server

                    }
                    if (audioBuffer.length > 1) {
                        audioBuffer.forEach(chunk => transcriptionServer.emit('streamAudio', chunk));
                        audioBuffer = []; // Clear the buffer
                    }
                    else if (audioBuffer.length == 1) {
                        transcriptionServer.emit('streamAudio', audioData);
                        audioBuffer = []; // Clear the buffer
                    }
                    else {
                        console.warn("VAD Voice detected, but no audio data");
                    }
                }
                break;
            default:
                console.warn("VAD Unknown event", res);
                break;
        }
    }).catch(console.error);
}

let tailTime = 4; // seconds
let lastTime = 0;

const handleStreamAudioButton = (audioData) => {

    if (isListening) {
        if (!transcriptionServer) { // Added this block
            handleStartAudio();
            // Send all chunks in the buffer to the transcription server
        }
        transcriptionServer.emit('streamAudio', audioData);

        lastTime = Date.now();

    }
    else if (Date.now() - lastTime < tailTime * 1000) {
        if (transcriptionServer) {
            transcriptionServer.emit('streamAudio', audioData);
        }
    }
    else {
        if (transcriptionServer) {
            handleEndAudio();
        }
    }

}