import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    SafeAreaView,
    Alert,
    RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';

// Components
import MicButton from '../components/MicButton';
import ChatMessage from '../components/ChatMessage';
import PersonaChip from '../components/PersonaChip';
import ActionButton from '../components/ActionButton';
import PersonaModal from '../components/PersonaModal';

// Services & Utils
import {
    sendAudio,
    getPersonas,
    createPersona,
    updatePersona,
    deletePersona,
    getJoke,
    getQuote,
    getWeather,
    getDateTime,
} from '../services/api';
import { useVoiceActivityDetection } from '../hooks/useVoiceActivityDetection';
import { requestAudioPermissions, configureAudioMode, RECORDING_OPTIONS } from '../utils/audio';
import { colors, gradients, spacing, borderRadius, SESSION_STATE } from '../theme';

/**
 * HomeScreen - Main screen of the Voice Companion app
 */
const HomeScreen = () => {
    // Session state for continuous listening
    const [sessionState, setSessionState] = useState(SESSION_STATE.IDLE);
    const [status, setStatus] = useState("Hi, I'm your AI companion. Tap Start to begin.");

    // Refs for continuous recording
    const recordingRef = useRef(null);
    const soundRef = useRef(null);
    const isProcessingRef = useRef(false);
    const turnCountRef = useRef(0);

    // Persona state
    const [personas, setPersonas] = useState([]);
    const [selectedPersonaId, setSelectedPersonaId] = useState(null);
    const [showPersonaModal, setShowPersonaModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Chat history state
    const [chatHistory, setChatHistory] = useState([]);
    const chatScrollRef = useRef(null);

    // User location state
    const [userLocation, setUserLocation] = useState({ latitude: null, longitude: null });

    // Load personas and get location on mount
    useEffect(() => {
        loadPersonas();
        getUserLocation();
        setupAudio();
    }, []);

    // Setup audio permissions
    const setupAudio = async () => {
        const hasPermission = await requestAudioPermissions();
        if (!hasPermission) {
            Alert.alert(
                'Microphone Permission Required',
                'Please enable microphone access to use the voice companion.',
                [{ text: 'OK' }]
            );
        }
        await configureAudioMode();
    };

    // Get user's geolocation
    const getUserLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Location permission denied');
                setStatus("📍 Location access denied. Weather will require city name.");
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            setUserLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });
            console.log('User location obtained:', location.coords);
        } catch (error) {
            console.warn('Could not get user location:', error);
        }
    };

    // Load personas from API
    const loadPersonas = async () => {
        try {
            const data = await getPersonas();
            setPersonas(data);

            // Select default persona if none selected
            if (!selectedPersonaId && data.length > 0) {
                const defaultPersona = data.find(p => p.is_default) || data[0];
                setSelectedPersonaId(defaultPersona.id);
            }
        } catch (error) {
            console.error('Failed to load personas:', error);
            Alert.alert('Error', 'Failed to load personas. Make sure the backend is running.');
        }
    };

    // Ref to track current session state
    const sessionStateRef = useRef(sessionState);
    useEffect(() => {
        sessionStateRef.current = sessionState;
    }, [sessionState]);

    // Callback when speech starts
    const handleSpeechStart = useCallback(() => {
        console.log('Speech detected - starting to record');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (sessionStateRef.current === SESSION_STATE.LISTENING) {
            setStatus("🗣️ Speaking detected... Keep talking!");
        }
    }, []);

    // Callback when speech ends (silence detected)
    const handleSpeechEnd = useCallback(async () => {
        console.log('Speech ended - processing audio');
        setStatus("⏸️ Silence detected - processing...");
        if (sessionStateRef.current === SESSION_STATE.LISTENING && !isProcessingRef.current) {
            isProcessingRef.current = true;
            await processRecording();
        }
    }, []);

    // Initialize VAD hook with improved sensitivity for normal microphones
    const { startVAD, stopVAD, audioLevel, isSpeaking, resetSpeechState } = useVoiceActivityDetection({
        onSpeechStart: handleSpeechStart,
        onSpeechEnd: handleSpeechEnd,
        silenceThreshold: -50,  // More sensitive for built-in mics
        silenceDuration: 2000,   // 2 seconds of silence before processing
        speechMinDuration: 400,  // Minimum 400ms of speech required
    });

    // Start continuous listening session
    const startSession = async () => {
        try {
            console.log('Starting continuous listening session...');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Create and start recording
            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync({
                ...RECORDING_OPTIONS,
                android: {
                    ...RECORDING_OPTIONS.android,
                    meteringEnabled: true,
                },
                ios: {
                    ...RECORDING_OPTIONS.ios,
                    meteringEnabled: true,
                },
            });
            await recording.startAsync();
            recordingRef.current = recording;

            // Start VAD
            await startVAD(recording);

            // Update state
            turnCountRef.current = 0;
            setSessionState(SESSION_STATE.LISTENING);
            setStatus("🎙️ Listening... Speak naturally, I'll respond when you pause.");
        } catch (error) {
            console.error("Error starting session:", error);
            setStatus("Error accessing microphone. Please check permissions.");
            Alert.alert('Error', 'Could not start recording. Please check microphone permissions.');
        }
    };

    // Stop continuous listening session
    const stopSession = async () => {
        console.log('Stopping session...');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        stopVAD();

        try {
            if (recordingRef.current) {
                await recordingRef.current.stopAndUnloadAsync();
                recordingRef.current = null;
            }
        } catch (error) {
            console.log('Error stopping recording:', error);
        }

        if (soundRef.current) {
            try {
                await soundRef.current.unloadAsync();
            } catch (error) {
                console.log('Error unloading sound:', error);
            }
            soundRef.current = null;
        }

        isProcessingRef.current = false;
        turnCountRef.current = 0;

        setSessionState(SESSION_STATE.IDLE);
        setStatus("Session ended. Tap Start to begin again.");
    };

    // Process recording and get AI response
    const processRecording = async () => {
        setSessionState(SESSION_STATE.PROCESSING);
        setStatus("🤔 Processing...");

        try {
            // Stop current recording and get URI
            const uri = recordingRef.current.getURI();
            await recordingRef.current.stopAndUnloadAsync();

            if (!uri) {
                throw new Error('No recording URI');
            }

            const isFirstMessage = turnCountRef.current === 0;
            turnCountRef.current += 1;

            // Send audio to backend
            const response = await sendAudio(
                uri,
                selectedPersonaId,
                userLocation.latitude,
                userLocation.longitude,
                isFirstMessage
            );

            // Add messages to chat history
            const userMessage = {
                id: Date.now(),
                type: 'user',
                text: response.transcript,
                intent: response.intent,
                tone: response.tone,
                timestamp: new Date(),
            };

            const aiMessage = {
                id: Date.now() + 1,
                type: 'ai',
                text: response.response_text,
                timestamp: new Date(),
            };

            setChatHistory(prev => [...prev, userMessage, aiMessage]);

            // Scroll to bottom
            setTimeout(() => {
                chatScrollRef.current?.scrollToEnd({ animated: true });
            }, 100);

            // Play audio response
            if (response.audio_base64) {
                setSessionState(SESSION_STATE.RESPONDING);
                setStatus("🔊 Speaking...");

                // Save base64 audio to file and play
                const audioUri = FileSystem.documentDirectory + 'response.mp3';
                await FileSystem.writeAsStringAsync(audioUri, response.audio_base64, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                const { sound } = await Audio.Sound.createAsync(
                    { uri: audioUri },
                    { shouldPlay: true }
                );
                soundRef.current = sound;

                // When audio finishes, resume listening
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.didJustFinish) {
                        resumeListening();
                    }
                });
            } else {
                resumeListening();
            }
        } catch (error) {
            console.error("Error processing audio:", error);
            setStatus("Sorry, I had trouble understanding. Try again...");
            resumeListening();
        }
    };

    // Resume listening after response
    const resumeListening = async () => {
        if (sessionStateRef.current === SESSION_STATE.IDLE) return;

        console.log('Resuming listening...');
        isProcessingRef.current = false;
        resetSpeechState();

        try {
            // Start new recording
            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync({
                ...RECORDING_OPTIONS,
                android: {
                    ...RECORDING_OPTIONS.android,
                    meteringEnabled: true,
                },
                ios: {
                    ...RECORDING_OPTIONS.ios,
                    meteringEnabled: true,
                },
            });
            await recording.startAsync();
            recordingRef.current = recording;

            // Restart VAD
            await startVAD(recording);

            setSessionState(SESSION_STATE.LISTENING);
            setStatus("🎙️ Listening...");
        } catch (error) {
            console.error('Error resuming listening:', error);
            stopSession();
        }
    };

    // Toggle session
    const toggleSession = () => {
        if (sessionState === SESSION_STATE.IDLE) {
            startSession();
        } else {
            stopSession();
        }
    };

    // Quick action handlers
    const handleJoke = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const joke = await getJoke();
            setStatus(joke);
        } catch (error) {
            setStatus("Couldn't think of a joke right now.");
        }
    };

    const handleQuote = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const quote = await getQuote();
            setStatus(quote);
        } catch (error) {
            setStatus("Couldn't find a quote right now.");
        }
    };

    const handleWeather = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const weatherData = await getWeather(
                null,
                userLocation.latitude,
                userLocation.longitude,
                selectedPersonaId
            );
            setStatus(weatherData.formatted_response);
        } catch (error) {
            setStatus("Couldn't get weather data. Try asking me directly!");
        }
    };

    const handleDateTime = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const dateTimeData = await getDateTime('Asia/Kolkata', selectedPersonaId);
            setStatus(dateTimeData.formatted_response);
        } catch (error) {
            setStatus("Couldn't get the time right now.");
        }
    };

    // Persona handlers
    const handleCreatePersona = async (personaData) => {
        try {
            await createPersona(personaData);
            await loadPersonas();
        } catch (error) {
            console.error('Failed to create persona:', error);
            Alert.alert('Error', 'Failed to create persona.');
        }
    };

    const handleUpdatePersona = async (id, personaData) => {
        try {
            await updatePersona(id, personaData);
            await loadPersonas();
        } catch (error) {
            console.error('Failed to update persona:', error);
            Alert.alert('Error', 'Failed to update persona.');
        }
    };

    const handleDeletePersona = async (id) => {
        try {
            await deletePersona(id);
            await loadPersonas();
        } catch (error) {
            console.error('Failed to delete persona:', error);
            Alert.alert('Error', 'Failed to delete persona.');
        }
    };

    // Pull to refresh
    const onRefresh = async () => {
        setRefreshing(true);
        await loadPersonas();
        setRefreshing(false);
    };

    const isSessionActive = sessionState !== SESSION_STATE.IDLE;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.background} />

            {/* Background gradient overlay */}
            <View style={styles.backgroundOverlay} />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.titleContainer}>
                    <Text style={styles.titleIcon}>🎙️</Text>
                    <Text style={styles.title}>Voice Companion</Text>
                </View>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => setShowPersonaModal(true)}
                >
                    <MaterialCommunityIcons name="cog" size={20} color={colors.textSecondary} />
                    <Text style={styles.settingsText}>Personas</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.mainContent}
                contentContainerStyle={styles.mainContentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
            >
                {/* Persona Selector */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.personaSelector}
                    contentContainerStyle={styles.personaSelectorContent}
                >
                    {personas.map(persona => (
                        <PersonaChip
                            key={persona.id}
                            persona={persona}
                            isActive={selectedPersonaId === persona.id}
                            onPress={() => setSelectedPersonaId(persona.id)}
                        />
                    ))}
                </ScrollView>

                {/* Chat History */}
                <View style={styles.chatContainer}>
                    <ScrollView
                        ref={chatScrollRef}
                        style={styles.chatHistory}
                        contentContainerStyle={styles.chatHistoryContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {chatHistory.length === 0 ? (
                            <View style={styles.chatEmpty}>
                                <Text style={styles.chatEmptyIcon}>💬</Text>
                                <Text style={styles.chatEmptyText}>
                                    Start speaking to begin the conversation
                                </Text>
                            </View>
                        ) : (
                            chatHistory.map(message => (
                                <ChatMessage key={message.id} message={message} />
                            ))
                        )}
                    </ScrollView>

                    {/* Status indicator */}
                    <View style={styles.chatStatus}>
                        <Text style={styles.statusText}>{status}</Text>
                    </View>
                </View>

                {/* Microphone Button */}
                <View style={styles.micContainer}>
                    <MicButton
                        sessionState={sessionState}
                        onPress={toggleSession}
                        audioLevel={audioLevel}
                        disabled={sessionState === SESSION_STATE.PROCESSING}
                    />
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.actions}
                    >
                        <ActionButton
                            icon="😄"
                            label="Joke"
                            onPress={handleJoke}
                            disabled={isSessionActive}
                        />
                        <ActionButton
                            icon="✨"
                            label="Inspire"
                            onPress={handleQuote}
                            disabled={isSessionActive}
                        />
                        <ActionButton
                            icon="🌤️"
                            label="Weather"
                            onPress={handleWeather}
                            disabled={isSessionActive}
                        />
                        <ActionButton
                            icon="🕐"
                            label="Time"
                            onPress={handleDateTime}
                            disabled={isSessionActive}
                        />
                    </ScrollView>
                </View>
            </ScrollView>

            {/* Persona Modal */}
            <PersonaModal
                visible={showPersonaModal}
                onClose={() => setShowPersonaModal(false)}
                personas={personas}
                onCreatePersona={handleCreatePersona}
                onUpdatePersona={handleUpdatePersona}
                onDeletePersona={handleDeletePersona}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    backgroundOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    titleIcon: {
        fontSize: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.primary,
    },
    settingsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.surface,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
    },
    settingsText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    mainContent: {
        flex: 1,
    },
    mainContentContainer: {
        paddingBottom: spacing.xxxl,
    },
    personaSelector: {
        maxHeight: 50,
        marginBottom: spacing.lg,
    },
    personaSelectorContent: {
        paddingHorizontal: spacing.xl,
        gap: spacing.sm,
    },
    chatContainer: {
        marginHorizontal: spacing.xl,
        flex: 1,
        minHeight: 250,
        maxHeight: 300,
        marginBottom: spacing.xl,
    },
    chatHistory: {
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
    },
    chatHistoryContent: {
        flexGrow: 1,
    },
    chatEmpty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxxl,
    },
    chatEmptyIcon: {
        fontSize: 48,
        opacity: 0.5,
        marginBottom: spacing.md,
    },
    chatEmptyText: {
        color: colors.textMuted,
        fontSize: 14,
        textAlign: 'center',
    },
    chatStatus: {
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    statusText: {
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
    },
    micContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: spacing.xl,
    },
    actionsContainer: {
        marginTop: spacing.md,
    },
    actions: {
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
    },
});

export default HomeScreen;
