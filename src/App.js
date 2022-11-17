import React, { Component } from 'react'
import * as audioUtils from "./audioUtils";
import mic from "microphone-stream";
import "./style.scss";


class App extends Component {
    state = {}
    transcription = []
    SAMPLE_RATE = 16000;
    SAMPLE_SIZE = 16
    
    startTranscribe = () => {
        window.navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
                echoCancellation: true,
                channelCount: 1,
                sampleRate: {
                    ideal: this.SAMPLE_RATE
                },
                sampleSize: this.SAMPLE_SIZE
            }
        })
        .then(this.streamAudioToWebSocket) 
        .catch( (error) => {
            this.handleError("There was an error streaming your audio to Amazon Transcribe. Please try again.")
        });
    }

    streamAudioToWebSocket = async (userMediaStream) => {
        try{
            this.micStream = new mic();
            this.micStream.on("format", (data) => {
                this.inputSampleRate = data.sampleRate;
                //console.log(data);
            });
            this.micStream.setStream(userMediaStream);
            this.socket = new WebSocket('ws://localhost:8000/ws/syncSocket/');
            this.socket.binaryType = "arraybuffer";
            this.socket.onopen = () => {
                this.micStream.on('data', (rawAudioChunk) => {
                    let binary = this.convertAudioToBinaryMessage(rawAudioChunk);
                    if (this.socket.readyState === this.socket.OPEN)
                        this.socket.send(binary);
                        //console.log("binary",binary)
                }
            )};
            this.wireSocketEvents();
        }catch(err){
            this.handleError("An error occured at streamAudioToWebSocket", err);
        }
    }


    wireSocketEvents() {
        // handle inbound messages from Transcribe
        let transcribeException = false;
        let socketError = false;
        this.socket.onmessage = (message) => {
            //handle socket transcribe response here
        };
    
        this.socket.onerror = () => {
            socketError = true;
            this.handleError("WebSocket connection error. Try again.");
        };
        
        this.socket.onclose = (closeEvent) => {
            this.micStream.stop();
            if (!socketError && !transcribeException) {
                if (closeEvent.code !== 1000) {
                    this.handleError('Streaming Exception: ' + closeEvent.reason);
                }
            }
        };
    }

    convertAudioToBinaryMessage(audioChunk) {
        //converting audiochunks to pcm buffer
        

        let raw = mic.toRaw(audioChunk);
        if (raw == null)
            return;    
        let downsampledBuffer = audioUtils.downsampleBuffer(raw, this.inputSampleRate, this.sampleRate);
        let pcmEncodedBuffer = audioUtils.pcmEncode(downsampledBuffer);    
        return pcmEncodedBuffer;
    }

    closeSocket = () => {
        if (this.socket && this.socket.readyState === this.socket.OPEN) {
            this.micStream.stop();
            this.socket.close();
        }
    }

    handleError = (err) => {
        this.closeTranscription();
        this.props.onError && this.props.onError(err);
    }

    handleMicClick = () => {
        if(this.state.started){
            this.closeTranscription();
        }else{
            this.startTranscription();
        }
    }

    startTranscription = () => {
        this.setState({started: true});
        this.startTranscribe();
    }

    closeTranscription = () => {
        this.setState({started: false});
        this.transcription = [];
        this.closeSocket();
        this.props.onClose && this.props.onClose()
    }

    startCloseWaitTimer = () => {
        if(this.t)
            clearTimeout(this.t);
        this.t = setTimeout(() => {
            this.closeTranscription();
        }, 10000);
    }
    
    render() {
        let { started } = this.state;
        return (
            <div className="stt-mic-container" onClick={this.handleMicClick}>
                <i 
                    className={`sttMic fa fa-microphone text-primary`} 
                />data
                <div className={`circle-ani ${started ? "active" : ""}`} />
            </div>
        )
    }
}

export default App;
