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

import userRoutes from './routes/userRoutes.js';
import Connection from './models/Connection.js';
import CommandHandler from './models/CommandHandler.js';
import { tryGetUserFromSession, handleDisconnect } from './utils/socketUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

app.get('/', (req, res) => {
    res.sendFile(join(__dirname + '/frontend/build/index.html'));
});


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

io.on('connection', async (socket) => {
    const user = tryGetUserFromSession(socket);
    const connection = new Connection(user, socket);
    
    new CommandHandler(connection);
    handleDisconnect(connection);
});

const port = process.env.PORT || 1000;
server.listen(port, () => {
    console.log(`listening on *:${port}`);
});