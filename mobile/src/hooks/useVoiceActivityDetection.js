import { useRef, useCallback, useEffect, useState } from 'react';
import { Audio } from 'expo-av';

/**
 * Voice Activity Detection (VAD) Hook for React Native
 * 
 * Uses Expo AV metering to detect speech activity in real-time.
 * Triggers callbacks when speech starts and ends based on audio levels.
 * 
 * @param {Object} options
 * @param {Function} options.onSpeechStart - Called when speech is detected
 * @param {Function} options.onSpeechEnd - Called when silence is detected after speech
 * @param {number} options.silenceThreshold - Metering level below which is considered silence (dB, default -50)
 * @param {number} options.silenceDuration - How long silence must last to trigger speech end (ms, default 2000)
 * @param {number} options.speechMinDuration - Minimum speech duration before silence detection activates (ms, default 400)
 */
export function useVoiceActivityDetection({
    onSpeechStart,
    onSpeechEnd,
    silenceThreshold = -50,
    silenceDuration = 2000,
    speechMinDuration = 400,
} = {}) {
    const recordingRef = useRef(null);
    const meteringIntervalRef = useRef(null);
    const isActiveRef = useRef(false);

    // Store callbacks in refs to always have latest version
    const onSpeechStartRef = useRef(onSpeechStart);
    const onSpeechEndRef = useRef(onSpeechEnd);

    // State tracking refs
    const isSpeakingRef = useRef(false);
    const silenceStartRef = useRef(null);
    const speechStartTimeRef = useRef(null);

    // Audio level for visualization (0-100)
    const [audioLevel, setAudioLevel] = useState(0);

    // Update refs when callbacks change
    useEffect(() => {
        onSpeechStartRef.current = onSpeechStart;
        onSpeechEndRef.current = onSpeechEnd;
    }, [onSpeechStart, onSpeechEnd]);

    /**
     * Get current audio level (0-100) for visualization
     */
    const getAudioLevel = useCallback(() => {
        return audioLevel;
    }, [audioLevel]);

    /**
     * Analyze metering levels and detect speech/silence
     */
    const analyzeMetering = useCallback((metering) => {
        if (!isActiveRef.current) return;

        const now = Date.now();

        // Convert metering (dB) to 0-100 scale
        // Metering typically ranges from -160 (silence) to 0 (max)
        // Using -80 to 0 range for better sensitivity with normal microphones
        const normalizedLevel = Math.max(0, Math.min(100, ((metering + 80) / 80) * 100));
        setAudioLevel(normalizedLevel);

        const isSoundDetected = metering > silenceThreshold;

        if (isSoundDetected) {
            // Sound detected
            if (!isSpeakingRef.current) {
                // Speech just started
                console.log('VAD: Speech started! metering=' + metering.toFixed(1));
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
                        console.log('VAD: Silence started after ' + speechDuration + 'ms of speech');
                        silenceStartRef.current = now;
                    } else if (now - silenceStartRef.current >= silenceDuration) {
                        // Silence duration exceeded - speech ended
                        console.log('VAD: Speech ended after ' + silenceDuration + 'ms silence');
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
    }, [silenceThreshold, silenceDuration, speechMinDuration]);

    /**
     * Start VAD with a recording
     */
    const startVAD = useCallback(async (recording) => {
        try {
            recordingRef.current = recording;
            isActiveRef.current = true;

            // Reset state
            isSpeakingRef.current = false;
            silenceStartRef.current = null;
            speechStartTimeRef.current = null;
            setAudioLevel(0);

            // Start metering interval
            meteringIntervalRef.current = setInterval(async () => {
                if (!isActiveRef.current || !recordingRef.current) return;

                try {
                    const status = await recordingRef.current.getStatusAsync();
                    if (status.isRecording && status.metering !== undefined) {
                        analyzeMetering(status.metering);
                    }
                } catch (error) {
                    console.log('VAD: Error getting metering', error);
                }
            }, 100); // Check every 100ms

            console.log('VAD started successfully');
            return true;
        } catch (error) {
            console.error('Failed to start VAD:', error);
            return false;
        }
    }, [analyzeMetering]);

    /**
     * Stop VAD and cleanup resources
     */
    const stopVAD = useCallback(() => {
        isActiveRef.current = false;

        if (meteringIntervalRef.current) {
            clearInterval(meteringIntervalRef.current);
            meteringIntervalRef.current = null;
        }

        recordingRef.current = null;

        // Reset state
        isSpeakingRef.current = false;
        silenceStartRef.current = null;
        speechStartTimeRef.current = null;
        setAudioLevel(0);

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
        audioLevel,
        resetSpeechState,
    };
}

export default useVoiceActivityDetection;
