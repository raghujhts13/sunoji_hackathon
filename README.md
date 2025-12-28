# Sunoji.me - AI Voice Companion

A low-latency speech-to-speech AI companion application that analyzes user intent, tone, and exact phrases to generate emotionally-appropriate voice responses.

## 📱 Features

### 🎙️ Continuous Voice Interaction
- **Voice Activity Detection (VAD)**: Automatically detects when you start and stop speaking
- **Natural Conversation Flow**: Speak naturally without pressing buttons for each interaction
- **Multi-turn Conversations**: Have extended conversations without restarting the session

### 🎭 Persona System
- **Multiple Personas**: Create and manage different AI personalities
- **Custom Prompts**: Define unique speaking styles and behaviors for each persona
- **Dynamic Switching**: Change personas on-the-fly during conversations

### 🧠 Intent & Tone Analysis
- **Intent Detection**: Identifies if you're venting, seeking advice, asking questions, or chatting casually
- **Emotional Tone**: Detects happiness, sadness, frustration, anxiety, excitement, and neutral states
- **Adaptive Responses**: AI adjusts its responses based on your emotional state

### 🔊 Dynamic Voice Synthesis
- **ElevenLabs TTS**: High-quality, natural-sounding voice responses
- **Emotional Adaptation**: Voice characteristics adjust based on detected emotions
- **Persona-Specific Voices**: Each persona can have unique voice settings

### 🛡️ Safety Features
- **Content Safety Guardrails**: Detects and handles sensitive topics appropriately
- **Crisis Resources**: Provides helpful resources when needed
- **Persona-Independent**: Safety features work regardless of persona settings

### ⚡ Quick Actions
- **Tell me a Joke**: Get a random joke
- **Inspire Me**: Receive motivational quotes
- **Weather**: Get current weather information
- **Time**: Check current date and time

---

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **AI/ML**: Google Vertex AI (Gemini)
- **Speech-to-Text**: Google Cloud Speech-to-Text
- **Text-to-Speech**: ElevenLabs API
- **Weather**: Open-Meteo API

### Mobile App (Android)
- **Framework**: React Native with Expo
- **Audio**: expo-av for recording and playback
- **Icons**: Expo Vector Icons
- **Navigation**: React Navigation
- **Animations**: React Native Reanimated
- **Styling**: Custom theme system with dark mode

---

## 📋 Requirements

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- Android Studio (for emulator) or physical Android device
- Expo Go app (for testing on device)

### API Keys Required
- Google Cloud Platform account with:
  - Speech-to-Text API enabled
  - Vertex AI API enabled
- ElevenLabs API key

---

## 🚀 Getting Started

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables (create .env file)
cp .env.example .env
# Edit .env with your API keys

# Run the backend
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

### 2. Mobile App Setup

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Start Expo development server
npx expo start

# For Android specifically
npx expo start --android
```

### 3. Configure Backend URL

Edit `mobile/src/services/api.js` and update the `API_BASE_URL`:

```javascript
// For Android Emulator (localhost):
const API_BASE_URL = 'http://10.0.2.2:8080';

// For physical device (use your computer's IP):
const API_BASE_URL = 'http://YOUR_IP_ADDRESS:8080';
```

---

## 📁 Project Structure

```
sunoji_hackathon/
├── backend/                    # FastAPI Backend
│   ├── main.py                 # API endpoints
│   ├── services.py             # Core services (STT, TTS, LLM)
│   ├── content_safety.py       # Safety guardrails
│   ├── persona_store.py        # Persona management
│   ├── weather_service.py      # Weather integration
│   ├── time_utils.py           # Time utilities
│   └── requirements.txt        # Python dependencies
│
├── mobile/                     # React Native App
│   ├── App.js                  # Main entry point
│   ├── app.json                # Expo config
│   └── src/
│       ├── components/         # UI Components
│       │   ├── MicButton.js
│       │   ├── ChatMessage.js
│       │   ├── PersonaChip.js
│       │   ├── ActionButton.js
│       │   └── PersonaModal.js
│       ├── screens/
│       │   └── HomeScreen.js   # Main screen
│       ├── hooks/
│       │   └── useVoiceActivityDetection.js
│       ├── services/
│       │   └── api.js          # API client
│       ├── theme/
│       │   └── index.js        # Design tokens
│       └── utils/
│           └── audio.js        # Audio utilities
│
├── frontend/                   # Legacy Web App (preserved)
│
├── FEATURES.md                 # Feature documentation
└── README.md                   # This file
```

---

## 🔒 Environment Variables

### Backend (.env)

```env
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
ELEVENLABS_API_KEY=your-elevenlabs-key
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

---

## 📱 Screenshots

*Coming soon after UI refinement*

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- Google Cloud Platform for STT and Vertex AI
- ElevenLabs for high-quality TTS
- Expo team for the amazing React Native tooling
- Open-Meteo for free weather API
