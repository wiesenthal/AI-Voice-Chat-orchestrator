// require events module
import { EventEmitter } from 'events';

import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

const client = new PollyClient(
    {
        region: "us-west-1"
    }
);

// TODO: move these to /configuration
const DEFAULT_ENGINE = "standard";
const DEFAULT_VOICE = "Amy";

// Polly Queue helper
class PollyQueue {
    constructor(socket) {
        this.queue = [];
        this.processing = false;
        this.eventEmitter = new EventEmitter();
        this.completedAudio = {};  // Stores completed audio streams by ID
        this.nextCountId = 1;  // The ID of the next audio stream to emit
        this.totalIdCount = 1; // The total number of audio streams emitted

        this.onAudioData(({ audioStream, audioID, commandID }) => {
            console.log('Sending audio data to client for command:', commandID);
            const base64Audio = audioStream.toString('base64');

            socket.emit('audioData', { audioStream: base64Audio, audioID, commandID });
        });
    }

    enqueue(request) {
        request.countId = this.totalIdCount++;
        this.queue.push(request);
        if (!this.processing) {
            this.processNext();
        }
    }

    enqueueCommand(words, commandID, engine=DEFAULT_ENGINE, voice=DEFAULT_VOICE) {
        this.enqueue({
            text: words,
            voice: voice,
            engine: engine,
            commandID: commandID
        });
    }

    async processNext() {
        if (this.queue.length > 0) {
            this.processing = true;
            const request = this.queue.shift();
            try {

                const fastMode = true;
                let input = {
                    Engine: request.engine || "neural",
                    OutputFormat: "mp3",
                    SampleRate: "16000",
                    Text: request.text,
                    TextType: "text",
                    VoiceId: request.voice || "Salli"
                };

                if (fastMode) {
                    // wrap text with <speak> tag and add SSML prosody tag
                    input = {
                        Engine: request.engine || "neural",
                        OutputFormat: "mp3",
                        SampleRate: "16000",
                        Text: `<speak><prosody rate="140%">${request.text}</prosody></speak>`,
                        TextType: "ssml",
                        VoiceId: request.voice || "Salli"
                    }

                }

                const data = await client.send(new SynthesizeSpeechCommand(input));

                let audioStream = [];
                // TODO: Use a stream instead of buffering the whole thing
                for await (const chunk of data.AudioStream) {
                    audioStream.push(chunk);
                }
                audioStream = Buffer.concat(audioStream);

                this.completedAudio[request.countId] = {audioStream: audioStream, commandID: request.commandID};
                this.sendNextCompletedAudio();
            } catch (err) {
                console.log('Error in Polly request:', err);
            }
            this.processing = false;
            process.nextTick(() => this.processNext());
        }
    }

    sendNextCompletedAudio() {
        while (this.completedAudio[this.nextCountId]) {
            const audioStream = this.completedAudio[this.nextCountId].audioStream;
            const commandID = this.completedAudio[this.nextCountId].commandID;
            delete this.completedAudio[this.nextCountId];

            this.eventEmitter.emit('audioData', { audioStream, audioID: this.nextCountId, commandID: commandID });
            this.nextCountId++;
        }
    }

    onAudioData(listener) {
        this.eventEmitter.on('audioData', listener);
    }
}

export default PollyQueue;