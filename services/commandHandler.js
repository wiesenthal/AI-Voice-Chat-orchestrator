import Command from '../models/Command.js';
import PollyQueue from '../models/PollyQueue.js';

// should handle the lifecycle of a command
export function handleCommandLifecycle(connection) {
    const pollyQueue = new PollyQueue(connection.socket);

    connection.on('startListen', () => {
        console.log('startListen');
        // create a new command, this command will go through its lifecycle
        const command = new Command(connection, pollyQueue);
    });
}