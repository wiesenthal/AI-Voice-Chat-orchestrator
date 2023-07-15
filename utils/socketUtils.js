import { sendDisconnectToBrain } from "../services/brainWrapper.js";
import { authenticateUserInDB } from "./userUtils.js";

function getUserFromSession(socket) {
    if (!socket.handshake)
        
    if (!socket.handshake.session)
        return null;
    if (!socket.handshake.session.user)
        return null;

    return socket.handshake.session.user;
}

export function tryGetUserFromSession(socket) {
    const user = getUserFromSession(socket);
    if (user === null) {
        console.error('No user found in session, logging session:');
        console.error(socket.handshake.session);
        socket.emit('redirect', '/login'); // tell frontend to redirect to login page
        socket.disconnect();
    }

    if (!authenticateUserInDB(user)) {
        console.error('User in session is not authenticated in DB, logging session:');
        console.error(socket.handshake.session);
        socket.emit('redirect', '/login'); // tell frontend to redirect to login page
        socket.disconnect();
    }

    return user;
}

export function handleDisconnect(connection) {
    connection.on('disconnect', () => {
        console.log(`disconnect, id: ${connection.socketID}, userID: ${connection.userID}`);
        sendDisconnectToBrain(connection.userID);
    });
}