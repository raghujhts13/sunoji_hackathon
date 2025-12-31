import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, shadows } from '../theme';

/**
 * ActionButton Component
 * 
 * Glass-morphism styled action buttons with icons
 * Used for quick actions like Joke, Quote, Weather, Time
 */
const ActionButton = ({ icon, label, onPress, disabled = false }) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={[styles.button, disabled && styles.buttonDisabled]}
            activeOpacity={0.7}
        >
            <View style={styles.content}>
                <Text style={styles.icon}>{icon}</Text>
                <Text style={[styles.label, disabled && styles.labelDisabled]}>
                    {label}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.full,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        minWidth: 100,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    icon: {
        fontSize: 16,
    },
    label: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    labelDisabled: {
        color: colors.textMuted,
    },
});

export default ActionButton;
