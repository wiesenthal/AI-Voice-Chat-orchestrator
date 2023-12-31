// a simple object storing the user and socket, and socket id
class Connection {
    constructor(user, socket) {
        this.user = user;
        this.userID = user.userID;
        this.socket = socket;
        this.socketID = socket.id;
    }

    emit(event, data) {
        this.socket.emit(event, data);
    }

    on(event, callback) {
        this.socket.on(event, callback);
    }

    destroy() {
        this.socket.disconnect();
    }
}

export default Connection;