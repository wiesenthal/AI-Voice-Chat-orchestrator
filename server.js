import express, { json, static as expressStatic } from 'express';
import session from 'express-session';
import { createServer, request as _request } from 'http';
import { join } from 'path';
import { Server } from "socket.io";
import { readFileSync, unlink } from 'fs';
import { FileWriter } from 'wav';
import cors from 'cors';
import { v4 } from 'uuid';

import dotenv from 'dotenv';
dotenv.config();

import { shouldRead } from './utils/readerUtils.js';
import { transcribe } from './services/deepgramTranscription.js';
import { authenticateJWT } from './services/authentication.js';
import { dbQueryPool } from './services/database.js';
import MessageHistory from './models/MessageHistory.js';
import PollyQueue from './models/PollyQueue.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const app = express();
app.use(cors());
app.use(json());

const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const brainRunningLocally = true;
const brainHostname = 'neohumanbrainresponsegenerator.us-west-1.elasticbeanstalk.com';

app.use(expressStatic(join(__dirname, 'frontend/build')));

app.use(session({
    secret: process.env.SESSION_SECRET_KEY,  // A secret string used to sign the session ID cookie
    resave: false,  // Don't save session if unmodified
    saveUninitialized: false,  // Don't create session until something is stored
    cookie: { secure: true, httpOnly: true, sameSite: true }  // Cookie options
}));

app.get('/', (req, res) => {
    res.sendFile(join(__dirname + '/frontend/build/index.html'));
});

app.get('/google-client-id', (req, res) => {
    res.json({"client_id": process.env.GOOGLE_CLIENT_ID});
});

app.post('/login', async (req, res) => {
    try {
        const payload = await authenticateJWT(req.body.token);
        console.log(`User logged in: ${JSON.stringify(payload)}`);
        // get user from database (or create new user)
        let userID = payload.sub;
        let email = payload.email;
        // test connection to database
        
        try {
            const [rows] = await dbQueryPool('SELECT 1');
            console.log(`Successfully made database query. Rows: ${JSON.stringify(rows)}`);
        } catch(err) {
            console.log(err);
        }

        // If credentials are valid:
        req.session.userId = payload.sub;  // Save something to session
        res.send({ success: true });
    } catch (err) {
        console.log(err);
        res.status(401).send({ success: false });
    }
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

    // We shouldn't need this with session cookies
    socket.on('join', (data) => {
        console.log(`User joined: ${JSON.stringify(data.user)}`);

        user = data.user;
    });

    socket.on('streamAudio', (audioData) => {
        // add audio data to a file
        if (isListening) {
            if (!fileWriter) {
                commandID = v4();
                filename = `audioFiles/${connectionID}-${commandID}.wav`;
                try {
                    fileWriter = new FileWriter(filename, {
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
                const audio = readFileSync(filename);

                const mimetype = "audio/x-wav;codec=pcm;rate=16000";
                const oldCommandID = commandID;
                transcribe(audio, mimetype).then((response) => {
                    handleTranscript(response, oldCommandID);
                }).catch((err) => {
                    console.log(err);
                });

                setTimeout((fname) => {
                    unlink(fname, (err) => {
                        if (err) {
                            console.log(`Error deleting file: ${err}`);
                        }
                    }
                    );
                }
                    , 5000, filename);

                fileWriter = null;
                filename = null;
                commandID = null;
            }
        }
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
            
            user_message_history.setMessage('user', commandID, transcript);
            user_message_history.setMessage('assistant', commandID, words);
            
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
