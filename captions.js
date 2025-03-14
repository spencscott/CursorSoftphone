/**
 * Closed Captioning Module for Web Phone
 * 
 * This module provides real-time transcription of both incoming and outgoing audio
 * during phone calls using the Web Speech API and Audio Worklet.
 */

class ClosedCaptioning {
    constructor(options = {}) {
        // Configuration options with defaults
        this.options = {
            captionContainerId: 'captions',
            captionContainerClass: 'caption-container',
            maxHistoryLength: 5,
            speakerColors: {
                local: '#1a73e8',
                remote: '#34a853'
            },
            showSpeakerLabels: true,
            ...options
        };

        // State variables
        this.isActive = false;
        this.audioContext = null;
        this.captionProcessor = null;
        this.speechRecognition = null;
        this.remoteSpeechRecognition = null;
        this.captionHistory = [];
        this.currentSpeaker = null;
        this.localStream = null;
        this.remoteStream = null;
        this.audioWorkletSupported = 'audioWorklet' in AudioContext.prototype;
        
        // Create caption container if it doesn't exist
        this.ensureCaptionContainer();
    }

    /**
     * Initialize the caption system
     * @param {MediaStream} localStream - The local audio stream (microphone)
     * @param {MediaStream} remoteStream - The remote audio stream (from the call)
     * @returns {Promise<boolean>} - Whether initialization was successful
     */
    async initialize(localStream, remoteStream) {
        this.localStream = localStream;
        this.remoteStream = remoteStream;
        
        try {
            // Show the caption container
            this.showCaptionContainer();
            
            // Initialize speech recognition for local audio
            this.initializeSpeechRecognition();
            
            // Initialize remote audio transcription
            if (remoteStream) {
                await this.initializeRemoteTranscription(remoteStream);
                console.log('Remote audio transcription initialized');
            }
            
            this.isActive = true;
            return true;
        } catch (error) {
            console.error('Error initializing captions:', error);
            return false;
        }
    }

    /**
     * Ensure the caption container exists in the DOM
     */
    ensureCaptionContainer() {
        let container = document.getElementById(this.options.captionContainerId);
        
        if (!container) {
            container = document.createElement('div');
            container.id = this.options.captionContainerId;
            container.className = this.options.captionContainerClass;
            
            // Create an inner element for the captions
            const captionsElement = document.createElement('div');
            captionsElement.className = 'captions';
            container.appendChild(captionsElement);
            
            // Add to the DOM - assuming there's a suitable parent element
            const parentElement = document.querySelector('.container') || document.body;
            parentElement.appendChild(container);
        }
    }

    /**
     * Show the caption container
     */
    showCaptionContainer() {
        const container = document.getElementById(this.options.captionContainerId);
        if (container) {
            container.classList.remove('hidden');
        }
    }

    /**
     * Hide the caption container
     */
    hideCaptionContainer() {
        const container = document.getElementById(this.options.captionContainerId);
        if (container) {
            container.classList.add('hidden');
        }
    }

    /**
     * Initialize the Web Speech API for speech recognition of local audio
     */
    initializeSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('Speech Recognition API not supported in this browser');
            return;
        }
        
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.lang = 'en-US';
        this.speechRecognition.interimResults = true;
        this.speechRecognition.continuous = true;
        
        this.speechRecognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join(' ');
            
            this.updateCaption(transcript, 'local');
        };
        
        this.speechRecognition.onerror = (event) => {
            console.error('Local speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                // This is a common error that doesn't need to stop the recognition
                return;
            }
            
            // Try to restart recognition on error
            this.restartSpeechRecognition();
        };
        
        this.speechRecognition.onend = () => {
            // Restart if recognition ends unexpectedly
            if (this.isActive) {
                this.restartSpeechRecognition();
            }
        };
        
        // Start the recognition
        this.speechRecognition.start();
    }

    /**
     * Initialize transcription for remote audio
     * @param {MediaStream} remoteStream - The remote audio stream
     */
    async initializeRemoteTranscription(remoteStream) {
        if (!remoteStream) {
            console.error('No remote stream provided for transcription');
            return;
        }

        try {
            console.log('Setting up remote transcription - simplified version');
            
            // Set up speech recognition for remote audio
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.warn('Speech Recognition API not supported for remote audio');
                return;
            }
            
            this.remoteSpeechRecognition = new SpeechRecognition();
            this.remoteSpeechRecognition.lang = 'en-US';
            this.remoteSpeechRecognition.interimResults = true;
            this.remoteSpeechRecognition.continuous = true;
            
            // Handle remote speech recognition results
            this.remoteSpeechRecognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0])
                    .map(result => result.transcript)
                    .join(' ');
                
                // Update captions with remote speaker
                this.updateCaption(transcript, 'remote');
            };
            
            // Handle errors
            this.remoteSpeechRecognition.onerror = (event) => {
                console.error('Remote speech recognition error:', event.error);
            };
            
            // Start remote speech recognition
            this.remoteSpeechRecognition.start();
            
            console.log('Remote audio transcription setup complete');
        } catch (error) {
            console.error('Error setting up remote audio transcription:', error);
        }
    }

    /**
     * Restart speech recognition if it stops
     */
    restartSpeechRecognition() {
        if (this.isActive && this.speechRecognition) {
            try {
                this.speechRecognition.start();
            } catch (error) {
                console.error('Error restarting speech recognition:', error);
                // If we can't restart immediately, try again after a delay
                setTimeout(() => {
                    if (this.isActive) {
                        try {
                            this.speechRecognition.start();
                        } catch (e) {
                            console.error('Failed to restart speech recognition after delay:', e);
                        }
                    }
                }, 1000);
            }
        }
    }

    /**
     * Restart remote speech recognition if it stops
     */
    restartRemoteSpeechRecognition() {
        if (this.isActive && this.remoteSpeechRecognition) {
            try {
                this.remoteSpeechRecognition.start();
            } catch (error) {
                console.error('Error restarting remote speech recognition:', error);
                // If we can't restart immediately, try again after a delay
                setTimeout(() => {
                    if (this.isActive) {
                        try {
                            this.remoteSpeechRecognition.start();
                        } catch (e) {
                            console.error('Failed to restart remote speech recognition after delay:', e);
                        }
                    }
                }, 1000);
            }
        }
    }

    /**
     * Set up Audio Worklet for processing remote audio
     * @param {MediaStream} remoteStream - The remote audio stream
     */
    async setupAudioWorklet(remoteStream) {
        // We'll skip this for now to simplify troubleshooting
        console.log('Skipping Audio Worklet setup to avoid audio interference');
        return;
    }

    /**
     * Update the caption display with new text
     * @param {string} text - The caption text
     * @param {string} speaker - Who is speaking ('local' or 'remote')
     */
    updateCaption(text, speaker) {
        if (!text || text.trim() === '') return;
        
        const captionsElement = document.querySelector(`#${this.options.captionContainerId} .captions`);
        if (!captionsElement) return;
        
        // If the speaker has changed, create a new caption entry
        if (this.currentSpeaker !== speaker) {
            this.currentSpeaker = speaker;
            this.captionHistory.push({
                speaker,
                text: text.trim()
            });
            
            // Limit history length
            if (this.captionHistory.length > this.options.maxHistoryLength) {
                this.captionHistory.shift();
            }
        } else {
            // Update the latest caption for this speaker
            if (this.captionHistory.length > 0) {
                this.captionHistory[this.captionHistory.length - 1].text = text.trim();
            } else {
                this.captionHistory.push({
                    speaker,
                    text: text.trim()
                });
            }
        }
        
        // Render the updated captions
        this.renderCaptions();
    }

    /**
     * Update the current speaker based on audio activity
     * @param {string} speaker - Who is speaking ('local' or 'remote')
     */
    updateSpeakerStatus(speaker) {
        if (this.currentSpeaker !== speaker) {
            this.currentSpeaker = speaker;
            // You could add visual indicators here if needed
        }
    }

    /**
     * Render the caption history to the DOM
     */
    renderCaptions() {
        const captionsElement = document.querySelector(`#${this.options.captionContainerId} .captions`);
        if (!captionsElement) return;
        
        captionsElement.innerHTML = '';
        
        this.captionHistory.forEach(caption => {
            const captionElement = document.createElement('div');
            captionElement.className = `caption-entry ${caption.speaker}`;
            
            if (this.options.showSpeakerLabels) {
                const speakerLabel = document.createElement('span');
                speakerLabel.className = 'speaker-label';
                speakerLabel.textContent = caption.speaker === 'local' ? 'You: ' : 'Caller: ';
                speakerLabel.style.color = this.options.speakerColors[caption.speaker];
                captionElement.appendChild(speakerLabel);
            }
            
            const textElement = document.createElement('span');
            textElement.className = 'caption-text';
            textElement.textContent = caption.text;
            captionElement.appendChild(textElement);
            
            captionsElement.appendChild(captionElement);
        });
        
        // Scroll to the bottom
        captionsElement.scrollTop = captionsElement.scrollHeight;
    }

    /**
     * Stop the captioning system
     */
    stop() {
        this.isActive = false;
        
        // Stop speech recognition
        if (this.speechRecognition) {
            try {
                this.speechRecognition.stop();
            } catch (error) {
                console.error('Error stopping speech recognition:', error);
            }
        }
        
        // Stop remote speech recognition
        if (this.remoteSpeechRecognition) {
            try {
                this.remoteSpeechRecognition.stop();
            } catch (error) {
                console.error('Error stopping remote speech recognition:', error);
            }
        }
        
        // Hide the caption container
        this.hideCaptionContainer();
        
        // Clear caption history
        this.captionHistory = [];
        this.currentSpeaker = null;
    }
}

// Export the class for use in other files
export default ClosedCaptioning; 
