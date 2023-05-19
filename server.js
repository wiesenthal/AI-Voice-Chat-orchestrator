const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const socketIoClient = require('socket.io-client');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Connecting to transcription server
const transcriptionServerAddress = 'http://localhost:3000';

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

let users = [];

io.on('connection', async (socket) => {

    console.log('a user connected');
    let transcriptionServer = null;

    const userID = socket.id;
    users.push(userID);

    socket.on('startAudio', async (unusedID) => {
        console.log('Start of Audio for user:' + userID);
        console.log('Users: ' + users);

        console.log('Connecting to transcription server');
        transcriptionServer = socketIoClient(transcriptionServerAddress);

        // Receive transcript from transcription server and forward it to client
        transcriptionServer.on('transcript', (data) => {
            handleTranscript(data);
        });

        // Forward command to transcription server
        transcriptionServer.emit('startAudio', userID);
    });

    socket.on('streamAudio', (audioData) => {
        // Forward audio data to transcription server
        if (transcriptionServer) 
            transcriptionServer.emit('streamAudio', audioData);
        else
            console.warn('Tried to streamAudio but transcription server not connected');
    });

    socket.on('endAudio', () => {
        console.log('End of Audio');
        // Forward command to transcription server
        if (transcriptionServer) {
            transcriptionServer.emit('endAudio');
            transcriptionServer.disconnect();
        }
        else
            console.warn('Tried to end audio, but transcription server not connected');
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        users = users.filter((user) => user !== userID);
        console.log('Users: ' + users);

        // Forward command to transcription server
        if (transcriptionServer) {
            console.warn('User disconnected, transcription server not disconnected, disconnecting now')
            transcriptionServer.disconnect();
        }
    });

    const handleTranscript = (data) => {
        console.log(data);
        socket.emit('transcript', data);
    }
});

server.listen(1000, () => {
    console.log('listening on *:1000');
});
