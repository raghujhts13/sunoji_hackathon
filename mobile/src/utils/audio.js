import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

/**
 * Audio utilities for React Native
 */

// Recording settings optimized for speech
export const RECORDING_OPTIONS = {
    android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
    },
    ios: {
        extension: '.m4a',
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
    },
    web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
    },
};

/**
 * Request audio recording permissions
 */
export const requestAudioPermissions = async () => {
    try {
        const { status } = await Audio.requestPermissionsAsync();
        return status === 'granted';
    } catch (error) {
        console.error('Error requesting audio permissions:', error);
        return false;
    }
};

/**
 * Configure audio mode for recording and playback
 */
export const configureAudioMode = async () => {
    try {
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
        });
        return true;
    } catch (error) {
        console.error('Error configuring audio mode:', error);
        return false;
    }
};

/**
 * Create and start a new recording
 */
export const startRecording = async () => {
    try {
        await configureAudioMode();

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(RECORDING_OPTIONS);
        await recording.startAsync();

        return recording;
    } catch (error) {
        console.error('Error starting recording:', error);
        throw error;
    }
};

/**
 * Stop recording and get the audio URI
 */
export const stopRecording = async (recording) => {
    try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        return uri;
    } catch (error) {
        console.error('Error stopping recording:', error);
        throw error;
    }
};

/**
 * Play audio from base64 string
 */
export const playBase64Audio = async (base64Audio) => {
    try {
        // Create a temporary file from base64
        const fileUri = FileSystem.documentDirectory + 'response_audio.mp3';
        await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // Load and play the audio
        const { sound } = await Audio.Sound.createAsync(
            { uri: fileUri },
            { shouldPlay: true }
        );

        return sound;
    } catch (error) {
        console.error('Error playing base64 audio:', error);
        throw error;
    }
};

/**
 * Play audio from URI
 */
export const playAudioFromUri = async (uri) => {
    try {
        const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: true }
        );
        return sound;
    } catch (error) {
        console.error('Error playing audio from URI:', error);
        throw error;
    }
};

/**
 * Get audio metering level from recording (for VAD visualization)
 */
export const getRecordingStatus = async (recording) => {
    try {
        const status = await recording.getStatusAsync();
        return {
            isRecording: status.isRecording,
            durationMillis: status.durationMillis,
            metering: status.metering || 0, // Audio level in dB
        };
    } catch (error) {
        console.error('Error getting recording status:', error);
        return { isRecording: false, durationMillis: 0, metering: 0 };
    }
};

export default {
    RECORDING_OPTIONS,
    requestAudioPermissions,
    configureAudioMode,
    startRecording,
    stopRecording,
    playBase64Audio,
    playAudioFromUri,
    getRecordingStatus,
};
