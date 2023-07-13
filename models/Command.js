import { v4 } from 'uuid';

import { initializeAudioFile, transcribeAudioFile, tryDeleteFile } from '../utils/audioUtils.js';
import { streamAudioToFile, onAudioComplete } from '../services/listenHandler.js';
import { sendTextToGPT } from '../services/brainWrapper.js';
import Response from './Response.js';

// Should store information about a command, including its ID, the user who issued it, the socket ID, the audio file, and the transcript (at various stages of lifecycle)
class Command {

    // a command will be birthed upon receiving the listen event from the frontend
    constructor(connection, pollyQueue) {
        this.connection = connection;
        this.pollyQueue = pollyQueue;

        // create a unique ID for this command
        this.commandID = v4();
        // initialize an audio file for this command
        const { filename, fileWriter } = initializeAudioFile(this.commandID);
        this.filename = filename;
        this.fileWriter = fileWriter;
        this.transcript = null;

        this.main();
    }

    async main() {
        // should alert the frontend that we received the audio
        console.log('Emitting receivedCommand');
        this.connection.emit('receivedCommand', { commandID: this.commandID });

        // pump in audio streamed from the front end into the audio file
        streamAudioToFile(this.connection.socket, this.fileWriter);

        await onAudioComplete(this.connection.socket);

        this.transcript = await transcribeAudioFile(this.filename);

        // if transcript.trim() is empty, then the user didn't say anything
        if (this.transcript.trim() === '') {
            console.log('User did not say anything. Ending command.');
            this.destroy();
            return;
        }

        // emit the transcript to the frontend
        this.connection.emit('transcript', { transcript: this.transcript, commandID: this.commandID });

        const response = new Response();
        for await (const word of sendTextToGPT(this.transcript, this.connection.userID, this.commandID)) {
            if (word == null) {
                console.log(`Received null word from brain. Ending command.`);
                break;
            }
            response.addWord(word);

            this.connection.emit('response', response.getFormattedWords(this.commandID));
            
            if (response.shouldRead()) {
                this.pollyQueue.enqueueCommand(response.getUnreadWords(), this.commandID);
                response.clearUnreadWords();
            }
        }

        this.destroy();
    }

    destroy() {
        console.log(`Command ${this.commandID} complete.`);
        this.connection.emit('commandComplete', { commandID: this.commandID });
        tryDeleteFile(this.filename);
    }
}

export default Command;