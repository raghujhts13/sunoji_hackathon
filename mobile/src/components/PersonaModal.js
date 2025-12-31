import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, borderRadius, spacing, shadows } from '../theme';

/**
 * PersonaModal Component
 * 
 * Bottom sheet modal for persona management:
 * - List of existing personas with edit/delete
 * - Create new persona form
 */
const PersonaModal = ({
    visible,
    onClose,
    personas,
    onCreatePersona,
    onUpdatePersona,
    onDeletePersona,
}) => {
    const [newPersonaName, setNewPersonaName] = useState('');
    const [newPersonaPrompt, setNewPersonaPrompt] = useState('');
    const [editingPersonaId, setEditingPersonaId] = useState(null);
    const [editPersonaName, setEditPersonaName] = useState('');
    const [editPersonaPrompt, setEditPersonaPrompt] = useState('');

    const handleCreatePersona = async () => {
        if (!newPersonaName.trim() || !newPersonaPrompt.trim()) return;

        await onCreatePersona({
            name: newPersonaName,
            base_prompt: newPersonaPrompt,
        });

        setNewPersonaName('');
        setNewPersonaPrompt('');
    };

    const handleEditPersona = (persona) => {
        setEditingPersonaId(persona.id);
        setEditPersonaName(persona.name);
        setEditPersonaPrompt(persona.base_prompt);
    };

    const handleUpdatePersona = async () => {
        if (!editPersonaName.trim() || !editPersonaPrompt.trim()) return;

        await onUpdatePersona(editingPersonaId, {
            name: editPersonaName,
            base_prompt: editPersonaPrompt,
        });

        setEditingPersonaId(null);
        setEditPersonaName('');
        setEditPersonaPrompt('');
    };

    const handleCancelEdit = () => {
        setEditingPersonaId(null);
        setEditPersonaName('');
        setEditPersonaPrompt('');
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={styles.modal}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Manage Personas</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                            {/* Existing Personas */}
                            <View style={styles.personaList}>
                                {personas.map((persona) => (
                                    <View key={persona.id} style={styles.personaItem}>
                                        {editingPersonaId === persona.id ? (
                                            // Edit mode
                                            <View style={styles.editForm}>
                                                <TextInput
                                                    style={styles.input}
                                                    value={editPersonaName}
                                                    onChangeText={setEditPersonaName}
                                                    placeholder="Persona name"
                                                    placeholderTextColor={colors.textMuted}
                                                />
                                                <TextInput
                                                    style={[styles.input, styles.textArea]}
                                                    value={editPersonaPrompt}
                                                    onChangeText={setEditPersonaPrompt}
                                                    placeholder="Base prompt"
                                                    placeholderTextColor={colors.textMuted}
                                                    multiline
                                                    numberOfLines={3}
                                                />
                                                <View style={styles.editActions}>
                                                    <TouchableOpacity
                                                        style={styles.saveButton}
                                                        onPress={handleUpdatePersona}
                                                    >
                                                        <LinearGradient
                                                            colors={gradients.success}
                                                            style={styles.gradientButton}
                                                        >
                                                            <MaterialCommunityIcons name="check" size={16} color="#fff" />
                                                            <Text style={styles.buttonText}>Save</Text>
                                                        </LinearGradient>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.cancelButton}
                                                        onPress={handleCancelEdit}
                                                    >
                                                        <MaterialCommunityIcons name="close" size={16} color={colors.textSecondary} />
                                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            // View mode
                                            <>
                                                <View style={styles.personaInfo}>
                                                    <Text style={styles.personaName}>
                                                        {persona.is_default && '★ '}
                                                        {persona.name}
                                                    </Text>
                                                    <Text style={styles.personaPreview} numberOfLines={1}>
                                                        {persona.base_prompt}
                                                    </Text>
                                                </View>
                                                <View style={styles.personaActions}>
                                                    <TouchableOpacity
                                                        style={styles.iconButton}
                                                        onPress={() => handleEditPersona(persona)}
                                                    >
                                                        <MaterialCommunityIcons name="pencil" size={20} color={colors.textMuted} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.iconButton}
                                                        onPress={() => onDeletePersona(persona.id)}
                                                    >
                                                        <MaterialCommunityIcons name="delete" size={20} color={colors.textMuted} />
                                                    </TouchableOpacity>
                                                </View>
                                            </>
                                        )}
                                    </View>
                                ))}
                            </View>

                            {/* Create New Persona */}
                            <View style={styles.createSection}>
                                <Text style={styles.sectionTitle}>Create New Persona</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newPersonaName}
                                    onChangeText={setNewPersonaName}
                                    placeholder="Persona name (e.g., 'Calm Advisor')"
                                    placeholderTextColor={colors.textMuted}
                                />
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={newPersonaPrompt}
                                    onChangeText={setNewPersonaPrompt}
                                    placeholder="Base prompt - describe the personality, tone, and how this persona should respond..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={4}
                                />
                                <TouchableOpacity
                                    style={[
                                        styles.createButton,
                                        (!newPersonaName.trim() || !newPersonaPrompt.trim()) && styles.createButtonDisabled,
                                    ]}
                                    onPress={handleCreatePersona}
                                    disabled={!newPersonaName.trim() || !newPersonaPrompt.trim()}
                                >
                                    <LinearGradient
                                        colors={gradients.primary}
                                        style={styles.gradientButton}
                                    >
                                        <Text style={styles.createButtonText}>Create Persona</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modal: {
        backgroundColor: '#1a1a2e',
        borderTopLeftRadius: borderRadius.lg,
        borderTopRightRadius: borderRadius.lg,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: colors.border,
        borderBottomWidth: 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    closeButton: {
        padding: spacing.sm,
    },
    body: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
    },
    personaList: {
        marginBottom: spacing.xl,
    },
    personaItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        marginBottom: spacing.sm,
    },
    personaInfo: {
        flex: 1,
        marginRight: spacing.md,
    },
    personaName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    personaPreview: {
        fontSize: 12,
        color: colors.textMuted,
    },
    personaActions: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    iconButton: {
        padding: spacing.sm,
    },
    editForm: {
        flex: 1,
    },
    editActions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    saveButton: {
        flex: 1,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    cancelButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
    },
    cancelButtonText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    gradientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    buttonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    createSection: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.xl,
        paddingBottom: spacing.xxxl,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.lg,
    },
    input: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        fontSize: 14,
        color: colors.text,
        marginBottom: spacing.md,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    createButton: {
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        marginTop: spacing.sm,
    },
    createButtonDisabled: {
        opacity: 0.5,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        paddingVertical: spacing.sm,
    },
});

export default PersonaModal;
