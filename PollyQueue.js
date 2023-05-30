// require events module
const events = require('events');
const axios = require('axios');

const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");

const client = new PollyClient();

DEFAULT_VOICE = "Matthew";

// Polly Queue helper
class PollyQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.eventEmitter = new events.EventEmitter();
        this.completedAudio = {};  // Stores completed audio streams by ID
        this.nextCountId = 1;  // The ID of the next audio stream to emit
        this.totalIdCount = 1; // The total number of audio streams emitted
    }

    enqueue(request) {
        request.countId = this.totalIdCount++;
        this.queue.push(request);
        if (!this.processing) {
            this.processNext();
        }
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
                        Text: `<speak><prosody rate="fast">${request.text}</prosody></speak>`,
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

                this.completedAudio[request.countId] = audioStream;
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
            const audioStream = this.completedAudio[this.nextCountId];
            delete this.completedAudio[this.nextCountId];

            this.eventEmitter.emit('audioData', { audioStream, id: this.nextCountId });
            this.nextCountId++;
        }
    }

    onAudioData(listener) {
        this.eventEmitter.on('audioData', listener);
    }
}
exports.default = PollyQueue;