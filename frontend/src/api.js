import axios from 'axios';

// Replace with your backend URL
const API_BASE_URL = 'http://localhost:8080';

const api = axios.create({
    baseURL: API_BASE_URL,
});

// ==================== CHAT ====================

export const sendAudio = async (audioBlob, userLatitude = null, userLongitude = null, isFirstMessage = false) => {
    try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');

        if (userLatitude !== null && userLongitude !== null) {
            formData.append('user_latitude', userLatitude);
            formData.append('user_longitude', userLongitude);
        }

        if (isFirstMessage) {
            formData.append('is_first_message', 'true');
        }

        // Now expecting JSON response with audio_base64
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

export const getWeather = async (locationQuery = null, latitude = null, longitude = null) => {
    try {
        const params = {};
        if (locationQuery) params.location_query = locationQuery;
        if (latitude !== null) params.latitude = latitude;
        if (longitude !== null) params.longitude = longitude;

        const response = await api.get('/weather', { params });
        return response.data;
    } catch (error) {
        console.error('Error getting weather:', error);
        throw error;
    }
};

export const getDateTime = async (timezone = 'Asia/Kolkata') => {
    try {
        const params = { timezone };

        const response = await api.get('/datetime', { params });
        return response.data;
    } catch (error) {
        console.error('Error getting datetime:', error);
        throw error;
    }
};

export const getGreeting = async (timezone = 'Asia/Kolkata') => {
    try {
        const params = { timezone };

        const response = await api.get('/greeting', { params });
        return response.data;
    } catch (error) {
        console.error('Error getting greeting:', error);
        throw error;
    }
};

// Helper to convert base64 to audio blob for playback
export const base64ToAudioBlob = (base64) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'audio/mpeg' });
};
