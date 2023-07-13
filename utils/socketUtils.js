import { sendDisconnectToBrain } from "../services/brainWrapper.js";

function getUserIDFromSession(socket) {
    if (!socket.handshake)
        
    if (!socket.handshake.session)
        return null;
    if (!socket.handshake.session.userID)
        return null;

    return socket.handshake.session.userID;
}

export function tryGetUserIDFromSession(socket) {
    const userID = getUserIDFromSession(socket);
    if (userID === null) {
        console.error('No user found in session, logging session:');
        console.error(socket.handshake.session);
        socket.emit('redirect', '/login'); // tell frontend to redirect to login page
        socket.disconnect();
    }
    return userID;
}

export function handleDisconnect(connection) {
    connection.on('disconnect', () => {
        console.log(`disconnect, id: ${connection.socketID}, userID: ${connection.userID}`);
        sendDisconnectToBrain(connection.userID);
    });
}