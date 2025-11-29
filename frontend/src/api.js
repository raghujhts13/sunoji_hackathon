import axios from 'axios';

// Replace with your backend URL
const API_BASE_URL = 'http://localhost:8080';

const api = axios.create({
    baseURL: API_BASE_URL,
});

export const sendAudio = async (audioBlob) => {
    try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.wav');

        // We expect a blob/audio response
        const response = await api.post('/chat', formData, {
            responseType: 'blob',
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
