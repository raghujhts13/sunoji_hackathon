import axios from 'axios';

// Replace with your actual backend URL after deployment
// For Android Emulator use 'http://10.0.2.2:8080'
// For iOS Simulator use 'http://localhost:8080'
// For Physical Device use your computer's IP or Cloud Run URL
const API_BASE_URL = 'http://10.0.2.2:8080'; 

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

export const sendAudio = async (uri) => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: uri,
      type: 'audio/wav', // or audio/m4a depending on recording settings
      name: 'recording.wav',
    });

    // We expect a blob/audio response
    const response = await api.post('/chat', formData, {
      responseType: 'blob', // or arraybuffer
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
    const response = await axios.get(`${API_BASE_URL}/joke`);
    return response.data.joke;
  } catch (error) {
    console.error('Error getting joke:', error);
    throw error;
  }
};

export const getQuote = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/quote`);
    return response.data.quote;
  } catch (error) {
    console.error('Error getting quote:', error);
    throw error;
  }
};
