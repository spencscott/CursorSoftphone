/**
 * Audio Worklet Processor for Closed Captioning
 * 
 * This processor analyzes incoming audio and sends it back to the main thread
 * for speech recognition processing.
 */

class CaptionProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // Configuration
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
        
        // Audio activity detection
        this.silenceThreshold = 0.01;
        this.silenceFrames = 0;
        this.maxSilenceFrames = 30; // About 0.6 seconds at 48kHz
        this.isActive = false;
        
        // Initialize
        this.init();
    }
    
    init() {
        // Send initialization message
        this.port.postMessage({
            caption: "Captions ready...",
            status: "initialized"
        });
    }
    
    process(inputs, outputs) {
        // Get the input audio data (first channel of first input)
        const input = inputs[0]?.[0];
        
        if (!input || input.length === 0) {
            return true; // Keep processor alive even without input
        }
        
        // Pass through audio to output if needed
        if (outputs.length > 0 && outputs[0].length > 0) {
            for (let channel = 0; channel < outputs[0].length; channel++) {
                const output = outputs[0][channel];
                for (let i = 0; i < input.length; i++) {
                    output[i] = input[i];
                }
            }
        }
        
        // Check for audio activity
        let audioLevel = 0;
        for (let i = 0; i < input.length; i++) {
            audioLevel += Math.abs(input[i]);
        }
        audioLevel /= input.length;
        
        // Detect speech vs. silence
        if (audioLevel > this.silenceThreshold) {
            this.silenceFrames = 0;
            
            if (!this.isActive) {
                this.isActive = true;
                this.port.postMessage({
                    status: "speech_start",
                    level: audioLevel
                });
            }
        } else {
            this.silenceFrames++;
            
            if (this.isActive && this.silenceFrames > this.maxSilenceFrames) {
                this.isActive = false;
                this.port.postMessage({
                    status: "speech_end",
                    level: audioLevel
                });
            }
        }
        
        // Buffer the audio data for processing
        for (let i = 0; i < input.length; i++) {
            this.buffer[this.bufferIndex++] = input[i];
            
            // When buffer is full, process it
            if (this.bufferIndex >= this.bufferSize) {
                this.processBuffer();
                this.bufferIndex = 0;
            }
        }
        
        // Return true to keep the processor running
        return true;
    }
    
    processBuffer() {
        // Only send audio data if we detect speech activity
        if (this.isActive) {
            // Create a copy of the buffer to send to the main thread
            const bufferCopy = this.buffer.slice(0);
            
            // Send the audio data to the main thread for processing
            this.port.postMessage({
                command: 'processAudio',
                audioBuffer: bufferCopy,
                timestamp: currentTime
            });
        }
    }
}

// Register the processor
registerProcessor('caption-processor', CaptionProcessor); 
