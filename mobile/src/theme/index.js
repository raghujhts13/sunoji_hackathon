/**
 * Theme Configuration for Sunoji.me Mobile App
 * 
 * Mobile-first design system with dark mode aesthetic,
 * matching the web application's premium look and feel.
 */

export const colors = {
    // Primary gradients
    primary: '#667eea',
    primaryDark: '#764ba2',

    // Accent gradients
    accent: '#f093fb',
    accentDark: '#f5576c',

    // Success/Active states
    success: '#11998e',
    successLight: '#38ef7d',

    // Recording state
    recording: '#f5576c',
    recordingLight: '#f093fb',

    // Background colors
    background: '#0f0f1a',
    surface: 'rgba(255, 255, 255, 0.05)',
    surfaceHover: 'rgba(255, 255, 255, 0.1)',

    // Text colors
    text: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textMuted: 'rgba(255, 255, 255, 0.5)',

    // Border colors
    border: 'rgba(255, 255, 255, 0.1)',
    borderGlow: 'rgba(102, 126, 234, 0.5)',

    // Status colors
    error: '#f5576c',
    warning: '#ffd700',
};

export const gradients = {
    primary: ['#667eea', '#764ba2'],
    accent: ['#f093fb', '#f5576c'],
    success: ['#11998e', '#38ef7d'],
    recording: ['#f5576c', '#f093fb'],
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const borderRadius = {
    sm: 8,
    md: 12,
    lg: 20,
    full: 9999,
};

export const typography = {
    fontFamily: {
        regular: 'System',
        medium: 'System',
        bold: 'System',
    },
    sizes: {
        xs: 10,
        sm: 12,
        md: 14,
        lg: 16,
        xl: 18,
        xxl: 24,
        xxxl: 28,
        display: 32,
    },
    weights: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
    },
};

export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    },
    glow: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
};

// Session states for continuous listening
export const SESSION_STATE = {
    IDLE: 'IDLE',
    LISTENING: 'LISTENING',
    PROCESSING: 'PROCESSING',
    RESPONDING: 'RESPONDING',
};

// Tone emojis
export const getToneEmoji = (tone) => {
    const emojis = {
        happy: '😊',
        sad: '😢',
        frustrated: '😤',
        neutral: '😐',
        anxious: '😰',
        excited: '🤩',
    };
    return emojis[tone] || '😐';
};

// Intent icons
export const getIntentIcon = (intent) => {
    const icons = {
        venting: 'thought-bubble',
        seeking_advice: 'lightbulb-on',
        casual_chat: 'chat',
        question: 'help-circle',
    };
    return icons[intent] || 'chat';
};

export default {
    colors,
    gradients,
    spacing,
    borderRadius,
    typography,
    shadows,
    SESSION_STATE,
    getToneEmoji,
    getIntentIcon,
};
