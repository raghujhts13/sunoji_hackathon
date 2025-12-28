import { useRef, useCallback, useEffect } from 'react';

/**
 * Voice Activity Detection (VAD) Hook
 * 
 * Uses Web Audio API to detect speech activity in real-time.
 * Triggers callbacks when speech starts and ends based on audio levels.
 * 
 * @param {Object} options
 * @param {Function} options.onSpeechStart - Called when speech is detected
 * @param {Function} options.onSpeechEnd - Called when silence is detected after speech
 * @param {number} options.silenceThreshold - Volume level below which is considered silence (0-255, default 5)
 * @param {number} options.silenceDuration - How long silence must last to trigger speech end (ms, default 2000)
 * @param {number} options.speechMinDuration - Minimum speech duration before silence detection activates (ms, default 400)
 */
export function useVoiceActivityDetection({
    onSpeechStart,
    onSpeechEnd,
    silenceThreshold = 5,
    silenceDuration = 2000,
    speechMinDuration = 400
} = {}) {
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const streamRef = useRef(null);
    const animationFrameRef = useRef(null);

    // Store callbacks in refs to always have latest version
    const onSpeechStartRef = useRef(onSpeechStart);
    const onSpeechEndRef = useRef(onSpeechEnd);

    // Update refs when callbacks change
    useEffect(() => {
        onSpeechStartRef.current = onSpeechStart;
        onSpeechEndRef.current = onSpeechEnd;
    }, [onSpeechStart, onSpeechEnd]);

    // State tracking refs
    const isSpeakingRef = useRef(false);
    const silenceStartRef = useRef(null);
    const speechStartTimeRef = useRef(null);
    const isActiveRef = useRef(false);

    // Audio level for visualization
    const audioLevelRef = useRef(0);

    /**
     * Get current audio level (0-100) for visualization
     */
    const getAudioLevel = useCallback(() => {
        return audioLevelRef.current;
    }, []);

    /**
     * Analyze audio levels and detect speech/silence
     */
    /**
     * Analyze audio levels and detect speech/silence using Time Domain Data (Waveform)
     */
    const analyzeAudio = useCallback(() => {
        if (!analyserRef.current || !isActiveRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.fftSize);
        // Use Time Domain Data (Waveform) for better volume detection
        analyserRef.current.getByteTimeDomainData(dataArray);

        // Calculate RMS (Root Mean Square) for volume
        // Data is 0-255, silence is 128
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128; // -1 to 1
            sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        // Convert RMS to simpler 0-100 scale
        const volume = Math.min(100, rms * 100 * 5); // Amplify a bit for sensitivity
        audioLevelRef.current = volume;

        const now = Date.now();
        // Threshold needs to be adjusted for RMS. 
        // rms 0.01 is quite quiet. 0.05 is speaking.
        // LOWERED threshold for better sensitivity with normal microphones
        // silenceThreshold of 5 should be very sensitive
        const effectiveThreshold = (silenceThreshold / 255) * 0.5; // Reduced by 50%

        const isSoundDetected = rms > effectiveThreshold && rms > 0.003; // Lowered from 0.005 to 0.003

        // Debug log every ~1 second
        if (Math.random() < 0.016) {
            console.log(`VAD: RMS=${rms.toFixed(4)}, Vol=${volume.toFixed(1)}, threshold=${effectiveThreshold.toFixed(4)}, speaking=${isSpeakingRef.current}`);

            // Critical Debug: Check if we are getting "flatline" (all 128 or all 0)
            if (volume === 0 && rms === 0) {
                const first_few = Array.from(dataArray.slice(0, 5)).join(',');
                console.log(`VAD WARNING: Zero signal. First 5 samples: [${first_few}]`);
            }
        }

        if (isSoundDetected) {
            // Sound detected
            if (!isSpeakingRef.current) {
                // Speech just started
                console.log(`VAD: Speech started! RMS=${rms.toFixed(4)}`);
                isSpeakingRef.current = true;
                speechStartTimeRef.current = now;
                silenceStartRef.current = null;

                if (onSpeechStartRef.current) {
                    onSpeechStartRef.current();
                }
            } else {
                // Continuing to speak - reset silence timer
                silenceStartRef.current = null;
            }
        } else {
            // Silence detected
            if (isSpeakingRef.current) {
                // Was speaking, now silent
                const speechDuration = now - (speechStartTimeRef.current || now);

                // Only start silence timer if speech was long enough
                if (speechDuration >= speechMinDuration) {
                    if (!silenceStartRef.current) {
                        // Start silence timer
                        console.log(`VAD: Silence started after ${speechDuration}ms. RMS=${rms.toFixed(4)}`);
                        silenceStartRef.current = now;
                    } else if (now - silenceStartRef.current >= silenceDuration) {
                        // Silence duration exceeded - speech ended
                        console.log(`VAD: Speech ended after ${silenceDuration}ms silence`);
                        isSpeakingRef.current = false;
                        silenceStartRef.current = null;
                        speechStartTimeRef.current = null;

                        if (onSpeechEndRef.current) {
                            onSpeechEndRef.current();
                        }
                    }
                }
            }
        }

        // Continue monitoring
        if (isActiveRef.current) {
            animationFrameRef.current = requestAnimationFrame(analyzeAudio);
        }
    }, [silenceThreshold, silenceDuration, speechMinDuration]);

    /**
     * Start VAD with a microphone stream
     */
    const startVAD = useCallback(async (stream) => {
        try {
            // Store stream reference
            streamRef.current = stream;

            // Diagnostic: Check Stream Tracks
            const audioTracks = stream.getAudioTracks();
            console.log(`VAD Start: Stream has ${audioTracks.length} audio tracks.`);
            audioTracks.forEach((track, i) => {
                console.log(`Track ${i}: label=${track.label}, enabled=${track.enabled}, muted=${track.muted}, state=${track.readyState}`);
                
                // CRITICAL FIX: Ensure track is enabled and not muted
                if (!track.enabled) {
                    console.warn(`Track ${i} was disabled, enabling it now`);
                    track.enabled = true;
                }
                if (track.muted) {
                    console.warn(`Track ${i} is muted at system level - this may prevent audio detection`);
                }
            });

            if (audioTracks.length === 0) {
                console.error("VAD Error: No audio tracks found in stream.");
            }

            // Create audio context
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

            // Create analyser node
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048; // Higher FFT size for better Time Domain resolution
            // smoothingTimeConstant not used for TimeDomainData

            // Connect microphone to analyser
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);

            // Reset state
            isSpeakingRef.current = false;
            silenceStartRef.current = null;
            speechStartTimeRef.current = null;
            isActiveRef.current = true;

            // Start analysis loop
            analyzeAudio();

            console.log('VAD started successfully');
            console.log('AudioContext state:', audioContextRef.current.state);
            console.log('Analyser FFT size:', analyserRef.current.fftSize);
            console.log('Frequency bin count:', analyserRef.current.frequencyBinCount);

            // Resume audio context if suspended (required in some browsers)
            if (audioContextRef.current.state === 'suspended') {
                console.log('Resuming audio context...');
                await audioContextRef.current.resume();
            }

            return true;
        } catch (error) {
            console.error('Failed to start VAD:', error);
            return false;
        }
    }, [analyzeAudio]);

    /**
     * Stop VAD and cleanup resources
     */
    const stopVAD = useCallback(() => {
        isActiveRef.current = false;

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }

        analyserRef.current = null;
        streamRef.current = null;

        // Reset state
        isSpeakingRef.current = false;
        silenceStartRef.current = null;
        speechStartTimeRef.current = null;
        audioLevelRef.current = 0;

        console.log('VAD stopped');
    }, []);

    /**
     * Check if currently detecting speech
     */
    const isSpeaking = useCallback(() => {
        return isSpeakingRef.current;
    }, []);

    /**
     * Reset speech state (useful after processing)
     */
    const resetSpeechState = useCallback(() => {
        isSpeakingRef.current = false;
        silenceStartRef.current = null;
        speechStartTimeRef.current = null;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopVAD();
        };
    }, [stopVAD]);

    return {
        startVAD,
        stopVAD,
        isSpeaking,
        getAudioLevel,
        resetSpeechState
    };
}

export default useVoiceActivityDetection;
