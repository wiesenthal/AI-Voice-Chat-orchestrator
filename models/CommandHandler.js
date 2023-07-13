import Command from './Command.js';
import PollyQueue from './PollyQueue.js';
import { sendCancelToBrain } from '../services/brainWrapper.js';

// handles the lifecycle of commands and cancelling them
export class CommandHandler {
    // constructed with a connection
    constructor(connection) {
        this.connection = connection;
        this.pollyQueue = new PollyQueue(connection.socket);
        this.commands = [];

        this.main();
    }

    main() {
        this.connection.on('startListen', () => {
            console.log('startListen');
            // create a new command, this command will go through its lifecycle
            this.commands.push(new Command(this.connection, this.pollyQueue));
        });

        this.connection.on('cancelCommand', (commandID) => {
            console.log(`cancelCommand received, commandID: ${commandID}`);
            sendCancelToBrain(this.connection.userID, commandID);
            // find the command with the given ID and cancel it
            for (let i = 0; i < this.commands.length; i++) {
                if (this.commands[i].commandID === commandID) {
                    this.commands[i].cancel();
                    this.commands.splice(i, 1);
                    return;
                }
            }
        });
    }
}

export default CommandHandler;