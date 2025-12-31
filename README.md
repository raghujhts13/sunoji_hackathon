# Sunoji.me - AI Voice Companion

A low-latency speech-to-speech AI companion that analyzes user intent, tone, and phrases to generate emotionally-appropriate voice responses.

## Features

- **Voice Activity Detection (VAD)** - Automatic speech detection for natural conversations
- **Intent & Tone Analysis** - Detects if you're venting, seeking advice, or chatting casually
- **Persona System** - Customizable AI personalities with unique speaking styles
- **Dynamic Voice Synthesis** - ElevenLabs TTS that adapts to your emotional state
- **Content Safety Guardrails** - Handles sensitive topics with supportive responses
- **Quick Actions** - Jokes and inspirational quotes on demand

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Python, FastAPI |
| **AI/ML** | Google Vertex AI (Gemini) |
| **Speech-to-Text** | Google Cloud Speech-to-Text |
| **Text-to-Speech** | ElevenLabs API |
| **Frontend** | Vite, React |

---

## Quick Start

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run server
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
ELEVENLABS_API_KEY=your-elevenlabs-key
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/chat` | Process audio and return AI voice response |
| `GET` | `/joke` | Get a random joke |
| `GET` | `/quote` | Get an inspirational quote |
| `GET` | `/` | Health check |

---

## Project Structure

```
sunoji_hackathon/
├── backend/
│   ├── main.py              # FastAPI endpoints
│   ├── services.py          # STT, TTS, LLM services
│   ├── content_safety.py    # Safety guardrails
│   ├── persona_store.py     # Persona management
│   ├── custom_responses.py  # Response phrase selector
│   ├── models.py            # Pydantic models
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main application
│   │   └── hooks/           # Custom React hooks
│   └── package.json
│
└── customResponses.txt      # Acknowledgment phrases
```

---

## License

MIT License
