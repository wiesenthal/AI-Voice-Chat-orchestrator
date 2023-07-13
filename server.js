import dotenv from 'dotenv';
dotenv.config();

import express, { json, static as expressStatic } from 'express';
import session from 'express-session';
import expressSocketIoSession from 'express-socket.io-session';
import { createServer } from 'http';
import { join } from 'path';
import { Server } from "socket.io";
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import userRoutes from './routes/userRoutes.js';
import Connection from './models/Connection.js';
import { handleCommandLifecycle } from './services/commandHandler.js';

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET_KEY,  // A secret string used to sign the session ID cookie
    resave: false,  // Don't save session if unmodified
    saveUninitialized: false,  // Don't create session until something is stored
    cookie: { secure: false, httpOnly: true, sameSite: true }  // Cookie options
});

const app = express();
app.use(cors());
app.use(json());
app.use(expressStatic(join(__dirname, 'frontend/build')));
app.use(sessionMiddleware);
app.use(userRoutes);

const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

io.use(expressSocketIoSession(sessionMiddleware, {
    autoSave: true
}));

app.get('/', (req, res) => {
    res.sendFile(join(__dirname + '/frontend/build/index.html'));
});

io.on('connection', async (socket) => {
    const connectionID = socket.id;

    let userID = null;
    // get user from express session, as set in userRoutes.js
    if (socket.handshake.session.userID) {
        userID = socket.handshake.session.userID;
        console.log(`Got user from session: ${userID}`);
    }
    else {
        console.error('No user found in session, logging session:');
        // log the session
        console.error(socket.handshake.session);
        // tell frontend to redirect to login page
        socket.emit('redirect', '/login');
        socket.disconnect();
        return;
    }

    const connection = new Connection(userID, socket);

    
    console.log('new connection, id: ', connectionID);
    
    handleCommandLifecycle(connection);

    socket.on('disconnect', () => {
        console.log('user disconnected, id: ', connectionID);
    });

    socket.on('cancelCommand', (commandID) => {
        //TODO: implement, send to brain
        console.log(`cancelCommand received, commandID: ${commandID}`);
    });

});

const port = process.env.PORT || 1000;
server.listen(port, () => {
    console.log(`listening on *:${port}`);
});
