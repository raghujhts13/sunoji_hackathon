import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, gradients, borderRadius, spacing, getToneEmoji, getIntentIcon } from '../theme';

/**
 * ChatMessage Component
 * 
 * Displays user and AI message bubbles with:
 * - Different styles for user (gradient) and AI (surface)
 * - Tone/intent badges for user messages
 * - Timestamp display
 */
const ChatMessage = ({ message }) => {
    const isUser = message.type === 'user';
    const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    const formatIntent = (intent) => {
        return intent ? intent.replace('_', ' ') : '';
    };

    return (
        <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
            {isUser ? (
                <LinearGradient
                    colors={gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.bubble, styles.userBubble]}
                >
                    <Text style={styles.messageText}>{message.text}</Text>

                    {/* Analysis badges for user messages */}
                    {message.intent && (
                        <View style={styles.analysisRow}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {getToneEmoji(message.tone)} {message.tone}
                                </Text>
                            </View>
                            <View style={styles.badge}>
                                <MaterialCommunityIcons
                                    name={getIntentIcon(message.intent)}
                                    size={12}
                                    color="rgba(255,255,255,0.9)"
                                />
                                <Text style={styles.badgeText}>{formatIntent(message.intent)}</Text>
                            </View>
                        </View>
                    )}
                </LinearGradient>
            ) : (
                <View style={[styles.bubble, styles.aiBubble]}>
                    <Text style={[styles.messageText, styles.aiMessageText]}>{message.text}</Text>
                </View>
            )}

            <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.aiTimestamp]}>
                {timestamp}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        maxWidth: '85%',
        marginBottom: spacing.md,
    },
    userContainer: {
        alignSelf: 'flex-end',
    },
    aiContainer: {
        alignSelf: 'flex-start',
    },
    bubble: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
    },
    userBubble: {
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        backgroundColor: colors.surfaceHover,
        borderWidth: 1,
        borderColor: colors.border,
        borderBottomLeftRadius: 4,
    },
    messageText: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 22,
    },
    aiMessageText: {
        color: colors.text,
    },
    analysisRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
        flexWrap: 'wrap',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 2,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.full,
    },
    badgeText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 11,
        textTransform: 'capitalize',
    },
    timestamp: {
        fontSize: 10,
        color: colors.textMuted,
        marginTop: 4,
        paddingHorizontal: 4,
    },
    userTimestamp: {
        textAlign: 'right',
    },
    aiTimestamp: {
        textAlign: 'left',
    },
});

export default ChatMessage;
