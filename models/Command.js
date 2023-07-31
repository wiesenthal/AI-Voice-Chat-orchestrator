import { v4 } from 'uuid';

import { initializeAudioFile, transcribeAudioFile, tryDeleteFile } from '../utils/audioFileUtils.js';
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
        this.isCancelled = false;

        this.main();
    }

    async main() {
        this.emitReceivedCommand();
        await this.receiveAudio();
        if (this.isCancelled) return;

        this.transcript = await transcribeAudioFile(this.filename);
        this.checkEmptyTranscript();
        this.emitTranscript();
        if (this.isCancelled) return;

        await this.makeResponseAndEmit();
        if (this.isCancelled) return;
        
        this.complete();
    }

    async receiveAudio() {
        // pump in audio streamed from the front end into the audio file
        const stopStreamingCallback = streamAudioToFile(this.connection.socket, this.fileWriter);

        await onAudioComplete(this.connection.socket);

        stopStreamingCallback();
    }

    async makeResponseAndEmit() {
        const response = new Response();
        for await (const word of sendTextToGPT(this.transcript, this.connection.userID, this.commandID)) {
            if (this.isCancelled) return;

            if (word == null) {
                // end of response
                break;
            }

            response.addWord(word);

            this.connection.emit('response', response.getFormattedWords(this.commandID));
            
            if (response.shouldRead()) {
                console.log(`Reading out: ${response.getUnreadWords()}`)
                this.pollyQueue.enqueueCommand(response.getUnreadWords(), this.commandID);
                response.clearUnreadWords();
            }
        }
    }

    emitTranscript() {
        this.connection.emit('transcript', { transcript: this.transcript, commandID: this.commandID });
    }

    emitReceivedCommand() {
        this.connection.emit('receivedCommand', { commandID: this.commandID });
    }

    checkEmptyTranscript() {
        if (!this.transcript || this.transcript.trim() === '') {
            console.log('User did not say anything. Ending command.');
            this.cancel();
        }
    }

    cancel() {
        console.log(`Command ${this.commandID} cancelled.`);
        this.isCancelled = true;

        tryDeleteFile(this.filename, this.fileWriter);
        this.connection.emit('commandComplete', { commandID: this.commandID });
    }

    complete() {
        console.log(`Command ${this.commandID} complete.`);

        tryDeleteFile(this.filename, this.fileWriter);
        this.connection.emit('commandComplete', { commandID: this.commandID });
    }
}

export default Command;