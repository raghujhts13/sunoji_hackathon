import axios from 'axios';
import * as FileSystem from 'expo-file-system';

// Replace with your backend URL
// For local development: use your computer's IP address (not localhost)
// For production: use your deployed backend URL
const API_BASE_URL = 'http://10.0.2.2:8080'; // Android emulator localhost

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // 30 second timeout for voice processing
});

// ==================== CHAT ====================

export const sendAudio = async (audioUri, personaId = null, userLatitude = null, userLongitude = null, isFirstMessage = false) => {
    try {
        const formData = new FormData();

        // For React Native, we need to create a proper file object
        const fileInfo = await FileSystem.getInfoAsync(audioUri);

        formData.append('file', {
            uri: audioUri,
            type: 'audio/m4a',
            name: 'recording.m4a',
        });

        if (personaId) {
            formData.append('persona_id', personaId);
        }

        if (userLatitude !== null && userLongitude !== null) {
            formData.append('user_latitude', userLatitude.toString());
            formData.append('user_longitude', userLongitude.toString());
        }

        if (isFirstMessage) {
            formData.append('is_first_message', 'true');
        }

        const response = await api.post('/chat', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        return response.data;
    } catch (error) {
        console.error('Error sending audio:', error);
        throw error;
    }
};

// ==================== PERSONAS ====================

export const getPersonas = async () => {
    try {
        const response = await api.get('/personas');
        return response.data;
    } catch (error) {
        console.error('Error getting personas:', error);
        throw error;
    }
};

export const getPersona = async (id) => {
    try {
        const response = await api.get(`/personas/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error getting persona:', error);
        throw error;
    }
};

export const createPersona = async (personaData) => {
    try {
        const response = await api.post('/personas', personaData);
        return response.data;
    } catch (error) {
        console.error('Error creating persona:', error);
        throw error;
    }
};

export const updatePersona = async (id, personaData) => {
    try {
        const response = await api.put(`/personas/${id}`, personaData);
        return response.data;
    } catch (error) {
        console.error('Error updating persona:', error);
        throw error;
    }
};

export const deletePersona = async (id) => {
    try {
        const response = await api.delete(`/personas/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting persona:', error);
        throw error;
    }
};

// ==================== UTILITIES ====================

export const getJoke = async () => {
    try {
        const response = await api.get('/joke');
        return response.data.joke;
    } catch (error) {
        console.error('Error getting joke:', error);
        throw error;
    }
};

export const getQuote = async () => {
    try {
        const response = await api.get('/quote');
        return response.data.quote;
    } catch (error) {
        console.error('Error getting quote:', error);
        throw error;
    }
};

// ==================== WEATHER & TIME ====================

export const getWeather = async (locationQuery = null, latitude = null, longitude = null, personaId = null) => {
    try {
        const params = {};
        if (locationQuery) params.location_query = locationQuery;
        if (latitude !== null) params.latitude = latitude;
        if (longitude !== null) params.longitude = longitude;
        if (personaId) params.persona_id = personaId;

        const response = await api.get('/weather', { params });
        return response.data;
    } catch (error) {
        console.error('Error getting weather:', error);
        throw error;
    }
};

export const getDateTime = async (timezone = 'Asia/Kolkata', personaId = null) => {
    try {
        const params = { timezone };
        if (personaId) params.persona_id = personaId;

        const response = await api.get('/datetime', { params });
        return response.data;
    } catch (error) {
        console.error('Error getting datetime:', error);
        throw error;
    }
};

export const getGreeting = async (personaId = null, timezone = 'Asia/Kolkata') => {
    try {
        const params = { timezone };
        if (personaId) params.persona_id = personaId;

        const response = await api.get('/greeting', { params });
        return response.data;
    } catch (error) {
        console.error('Error getting greeting:', error);
        throw error;
    }
};

// Helper to set the API base URL dynamically
export const setApiBaseUrl = (url) => {
    api.defaults.baseURL = url;
};

export default api;
