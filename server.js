const express = require('express');
const session = require('express-session');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const fs = require('fs');
const wav = require('wav');
const cors = require('cors');
const { v4 } = require('uuid');

require('dotenv').config();

const { shouldRead } = require('./utils/reader_utils.js');
const { transcribe } = require('./deepgram/transcription.js');
const { authenticateJWT } = require('./utils/authentication.js');
const MessageHistory = require('./utils/MessageHistory.js').default;
const PollyQueue = require('./utils/PollyQueue.js').default;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
    }
});

const brainRunningLocally = false;
const brainHostname = 'neohumanbrainresponsegenerator.us-west-1.elasticbeanstalk.com';

// connect to MySQL database

app.use(express.static(path.join(__dirname, 'frontend/build')));

app.use(session({
    secret: process.env.SESSION_SECRET_KEY,  // A secret string used to sign the session ID cookie
    resave: false,  // Don't save session if unmodified
    saveUninitialized: false,  // Don't create session until something is stored
    cookie: { secure: true, httpOnly: true, sameSite: true }  // Cookie options
}));


app.get('/', (req, res) => {
    // res.sendFile(__dirname + '/public/index.html');
    res.sendFile(path.join(__dirname + '/frontend/build/index.html'));
});

app.get('/google-client-id', (req, res) => {
    res.json({"client_id": process.env.GOOGLE_CLIENT_ID});
});

app.post('/login', (req, res) => {
    // Verify user credentials (or third-party token)
    console.log(req.body);
    authenticateJWT(req.body.token).then((payload) => {
        console.log(`User logged in: ${JSON.stringify(payload)}`);
        // get user from database (or create new user)
        let userID = payload.sub;
        let email = payload.email;
        // test connection to database


        // If credentials are valid:
        req.session.userId = payload.sub;  // Save something to session
        res.send({ success: true });
    }).catch((err) => {
        console.log(err);
        res.status(401).send({ success: false });
    });
});

let users = [];

io.on('connection', async (socket) => {
    
    const pollyQueue = new PollyQueue();
    
    console.log('a user connected');

    const connectionID = socket.id;
    users.push(connectionID);

    let isListening = false;
    let fileWriter = null;
    let commandID = null;
    let filename = null;

    let user = null;

    socket.on('join', (data) => {
        console.log(`User joined: ${JSON.stringify(data.user)}`);

        user = data.user;
    });

    socket.on('streamAudio', (audioData) => {
        // add audio data to a file
        if (isListening) {
            if (!fileWriter) {
                commandID = v4();
                filename = `audio/${connectionID}-${commandID}.wav`;
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
                const oldCommandID = commandID;
                transcribe(audio, mimetype).then((response) => {
                    handleTranscript(response, oldCommandID);
                }).catch((err) => {
                    console.log(err);
                });

                setTimeout((fname) => {
                    fs.unlink(fname, (err) => {
                        if (err) {
                            console.log(`Error deleting file: ${err}`);
                        }
                    }
                    );
                }
                    , 5000, fname = filename);

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
        console.log('Listening for user: ' + connectionID);
        isListening = true;
    });

    socket.on('stopListening', () => {
        console.log('Stopped listening for user: ' + connectionID);
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
        console.log('Now recording for user: ' + connectionID);
    });

    // instantiate message history
    let user_message_history = new MessageHistory(connectionID);


    const handleTranscript = async (transcript, commandID) => {
        console.log('Transcript: ', transcript);

        let words = "";
        let unread_words = "";

        // send the transcript to GPT
        for await (const word of sendTextToGPT(transcript)) {
            if (word === null) {
                console.log(`user message history`, user_message_history);
                break;
            }

            words += word;
            unread_words += word;
            const formatted_words = {
                "words": words,
                "responseId": commandID
            }

            socket.emit('response', formatted_words);
            
            user_message_history.setMessage(role = 'user', id = commandID, content = transcript);

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

        const request = http.request(options, (response) => {

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
        users = users.filter((user) => user !== connectionID);
    }

});

const port = process.env.PORT || 1000;
server.listen(port, () => {
    console.log(`listening on *:${port}`);
});
