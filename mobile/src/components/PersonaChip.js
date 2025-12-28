import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, borderRadius, spacing } from '../theme';

/**
 * PersonaChip Component
 * 
 * Selectable chip for persona selection with:
 * - Active state with gradient background
 * - Default badge indicator
 */
const PersonaChip = ({ persona, isActive, onPress }) => {
    if (isActive) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
                <LinearGradient
                    colors={gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.chip, styles.activeChip]}
                >
                    <Text style={[styles.chipText, styles.activeChipText]}>
                        {persona.name}
                    </Text>
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            style={styles.chip}
            activeOpacity={0.7}
        >
            <Text style={styles.chipText}>{persona.name}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    chip: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.full,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    activeChip: {
        borderWidth: 0,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 4,
    },
    chipText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    activeChipText: {
        color: '#fff',
        fontWeight: '500',
    },
});

export default PersonaChip;
