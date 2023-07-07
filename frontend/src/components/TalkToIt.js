import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import ListenButton from './ListenButton';

const runningLocally = true;
const localAddress = "http://localhost:1000";
const remoteAddress = "https://www.personalwaifu.com";

const TalkToIt = ({user}) => {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [activeLine, setActiveLine] = useState('');
  const [transcripts, setTranscripts] = useState([]);
  const [responses, setResponses] = useState([]);
  const audioStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const desiredSampleRateRef = useRef(16000); // Assuming this as the desired sample rate
  const socket = useRef(null);
  const audioQueue = useRef([]);

  useEffect(() => {

    // this socket needs to be associated with the user id
    socket.current = io(runningLocally ? localAddress : remoteAddress);
  
    // We shouldn't need this with session cookies
    socket.current.on('connect', () => {
      console.log('Connected to server');
      socket.current.emit('join', { user: user });
    });

    socket.current.on('response', (data) => {
      setResponses((prevResponses) => {
        let newResponses = [...prevResponses];
        let index = newResponses.findIndex((response) => response.id === `response_${data.responseId}`);
        if (index === -1) {
          newResponses.push({ id: `response_${data.responseId}`, text: data.words });
        } else {
          newResponses[index] = { id: `response_${data.responseId}`, text: data.words };
        }
        return newResponses;
      });
    });

    function playAudio() {
      if (audioQueue.current.length > 0) {
        let audio = audioQueue.current[0];
        audio.play();
        audio.onended = () => {
          audioQueue.current.shift();
          playAudio();
        };
      }
    }

    socket.current.on('audioData', (data) => {
      let audio = new Audio('data:audio/mp3;base64,' + data.audioStream);
      audioQueue.current.push(audio);
      if (audioQueue.current.length === 1) {
        playAudio();
      }
    });

    return () => {
      socket.current.close();
    };
  }, []);

  const startListening = () => {
    socket.current.emit('listen');
    if (!audioEnabled) {
      let audio = new Audio();
      audio
        .play()
        .then(() => {
          setAudioEnabled(true);
        })
        .catch((err) => {
          console.warn(err);
          console.warn('Autoplay was prevented. Please enable audio.');
        });
    }
  };

  const stopListening = () => {
    socket.current.emit('stopListening');
  };

  const startRecording = async () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: desiredSampleRateRef.current });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioStreamRef.current = stream;
    const audioInput = audioContext.createMediaStreamSource(stream);
    const bufferSize = 2048;
    const recorder = audioContext.createScriptProcessor(bufferSize, 1, 1);
    recorderRef.current = recorder;

    recorder.onaudioprocess = (e) => {
      let inputBuffer = e.inputBuffer;
      let inputData = inputBuffer.getChannelData(0);
      let PCM32fSamples = new Float32Array(inputData);
      let PCM16iSamples = PCM32fSamples.map(x => Math.max(-32768, Math.min(32767, Math.floor(x * 32767))));
      if (desiredSampleRateRef.current !== audioContext.sampleRate) {
        console.warn('The desired sample rate is different from the audio context sample rate');
      }
      sendToServer(new Int16Array(PCM16iSamples).buffer);
    };

    audioInput.connect(recorder);
    recorder.connect(audioContext.destination);
    socket.current.emit('startAudio');

    if (!audioEnabled) {
      let audio = new Audio();
      audio.play()
        .then(_ => {
          setAudioEnabled(true);
        })
        .catch(err => {
          console.warn("Autoplay was prevented. Please enable audio.");
        });
    }
  }

  // We really don't need this
  const stopRecording = async () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks()[0].stop();
      recorderRef.current.disconnect();
      console.log('Audio stream stopped');
    }
  }

  const sendToServer = (buffer) => {
    socket.current.emit('streamAudio', buffer);
  }

  return (
    <div className="TalkToIt">
      <button onClick={startRecording}>Start Recording</button>
      <button onClick={stopRecording}>Stop Recording</button>
      <ListenButton onStartListening={startListening} onStopListening={stopListening} />
      <div id="output">
        {activeLine && <p>{activeLine}</p>}
        {transcripts.map((transcript, index) => (
          <p key={index}>{transcript}</p>
        ))}
        {responses.map((response) => (
          <p key={response.id}>{response.text}</p>
        ))}
      </div>
    </div>
  );
}

export default TalkToIt;