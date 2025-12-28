import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, gradients, shadows, SESSION_STATE } from '../theme';

/**
 * MicButton Component
 * 
 * Large, animated microphone button with visual states:
 * - IDLE: Primary gradient, shows "Start"
 * - LISTENING: Green gradient, shows "Stop" 
 * - PROCESSING: Accent gradient with spinner
 * - RESPONDING: Blue gradient, shows "Speaking"
 */
const MicButton = ({ sessionState, onPress, audioLevel = 0, disabled = false }) => {
    const isIdle = sessionState === SESSION_STATE.IDLE;
    const isListening = sessionState === SESSION_STATE.LISTENING;
    const isProcessing = sessionState === SESSION_STATE.PROCESSING;
    const isResponding = sessionState === SESSION_STATE.RESPONDING;

    // Determine gradient colors based on state
    const getGradientColors = () => {
        if (isListening) return gradients.success;
        if (isProcessing) return gradients.accent;
        if (isResponding) return gradients.primary;
        return gradients.primary;
    };

    // Determine icon based on state
    const getIcon = () => {
        if (isIdle) return 'microphone';
        if (isListening) return 'stop';
        if (isResponding) return 'volume-high';
        return 'microphone';
    };

    // Determine label based on state
    const getLabel = () => {
        if (isIdle) return 'Start';
        if (isListening) return 'Stop';
        if (isProcessing) return 'Processing';
        if (isResponding) return 'Speaking';
        return 'Start';
    };

    // Calculate audio level ring scale
    const audioLevelScale = 1 + (audioLevel / 100) * 0.3;

    return (
        <View style={styles.container}>
            {/* Audio Level Ring - only show when listening */}
            {isListening && (
                <View
                    style={[
                        styles.audioLevelRing,
                        {
                            transform: [{ scale: audioLevelScale }],
                            opacity: 0.3 + (audioLevel / 100) * 0.4,
                        },
                    ]}
                />
            )}

            {/* Pulse Ring - only show when listening */}
            {isListening && (
                <Animated.View style={styles.pulseRing} />
            )}

            <TouchableOpacity
                onPress={onPress}
                disabled={disabled || isProcessing}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={getGradientColors()}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.button,
                        (disabled || isProcessing) && styles.buttonDisabled,
                    ]}
                >
                    <View style={styles.innerContent}>
                        {isProcessing ? (
                            <ActivityIndicator size="large" color="#fff" />
                        ) : (
                            <>
                                <MaterialCommunityIcons
                                    name={getIcon()}
                                    size={48}
                                    color="#fff"
                                />
                                <Text style={styles.label}>{getLabel()}</Text>
                            </>
                        )}
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: 160,
        height: 160,
    },
    button: {
        width: 140,
        height: 140,
        borderRadius: 70,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.lg,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    innerContent: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    label: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    audioLevelRing: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: colors.successLight,
        opacity: 0.3,
    },
    pulseRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 2,
        borderColor: colors.successLight,
        opacity: 0.5,
    },
});

export default MicButton;
