const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const wav = require('wav');

const { shouldRead } = require('./reader_utils.js');
const { transcribe } = require('./deepgram/transcription.js');
const { v4 } = require('uuid');

const MessageHistory = require('./MessageHistory').default;
const PollyQueue = require('./PollyQueue').default;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const pollyQueue = new PollyQueue();  // Instantiate PollyQueue

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

let users = [];

io.on('connection', async (socket) => {

    console.log('a user connected');

    const userID = socket.id;
    users.push(userID);

    let isListening = false;
    let fileWriter = null;
    let commandID = null;
    let filename = null;


    socket.on('streamAudio', (audioData) => {
        // handleStreamAudioDetection(audioData);
        //handleStreamAudioButton(audioData);

        // add audio data to a file
        if (isListening) {
            if (!fileWriter) {
                commandID = v4();
                filename = `audio/${userID}-${commandID}.wav`;
                try {
                    fileWriter = new wav.FileWriter(filename, {
                        channels: 1,
                        sampleRate: 16000,
                        bitDepth: 16,
                    });
                }
                catch (err) {
                    console.log(`Error creating fileWriter: ${err}`);
                }
            }
            try {
            fileWriter.write(Buffer.from(audioData));
            }
            catch (err) {
                console.log(`Error writing to file: ${err}`);
            }
        }
        else {
            if (fileWriter) {
                try {
                fileWriter.end();
                }
                catch (err) {
                    console.log(`Error ending fileWriter: ${err}`);
                }

                // send the audio to deepgram
                console.log(`filename: ${filename}`);
                const audio = fs.readFileSync(filename);

                const mimetype = "audio/x-wav;codec=pcm;rate=16000";

                transcribe(audio, mimetype).then((response) => {
                    handleTranscript(response, commandID);
                }).catch((err) => {
                    console.log(err);
                });

                // delete the file in 5 seconds
                setTimeout((fname) => {
                    fs.unlink(fname, (err) => {
                        if (err) {
                            console.log(`Error deleting file: ${err}`);
                        }
                    }
                    );
                }
                , 5000, fname=filename);

                fileWriter = null;
                filename = null;
                commandID = null;
            }
        }
    });

    socket.on('endAudio', () => {
        handleEndAudio();
    });

    socket.on('disconnect', () => {
        handleAudioDisconnect();
    });

    socket.on('listen', () => {
        console.log('Listening for user: ' + userID);
        isListening = true;
    });

    socket.on('stopListening', () => {
        console.log('Stopped listening for user: ' + userID);
        isListening = false;
    });

    // Listen for completed audio streams from PollyQueue
    pollyQueue.onAudioData(({ audioStream, id }) => {
        console.log('Sending audio data to client:', id);
        // save the audio stream to a file

        const base64Audio = audioStream.toString('base64');

        socket.emit('audioData', { audioStream: base64Audio, id });
    });

    socket.on('startAudio', async () => {
        console.log('Now recording for user: ' + userID);
    });

    // instantiate message history
    let user_message_history = new MessageHistory(userID);


    const handleTranscript = async (transcript, commandID) => {
        console.log('Transcript: ', transcript);

        let words = "";
        let unread_words = "";

        // send the transcript to GPT
        for await (const word of sendTextToGPT(transcript)) {
            words += word;
            unread_words += word;
            const formatted_words = {
                "words": words,
                "responseId": commandID
            }
    
            socket.emit('response', formatted_words);
            // message history should be updated here
            user_message_history.setMessage(role = 'assistant', id = commandID, content = words);
            if (shouldRead(unread_words)) {
                console.log("Should read: ", unread_words);
                // send unread_words to polly and we need to queue it to send to the client
    
                // we should monolithify Polly
                pollyQueue.enqueue({
                    text: unread_words,
                    voice: 'Amy',  // Set your preferred voice ID
                    engine: 'standard',
                    audioId: commandID
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
                chunks.push(chunk);
                promises.push(new Promise(resolve => chunks.push = resolve));
            });

            response.on('end', () => {
                console.log('End of response');
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

    const handleAudioDisconnect = () => {
        console.log('user disconnected');
        users = users.filter((user) => user !== userID);
    }

});

server.listen(1000, () => {
    console.log('listening on *:1000');
});
