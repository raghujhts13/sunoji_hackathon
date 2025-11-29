# Sunoji.me Implementation Plan

## Goal Description
Develop 'Sunoji.me', a cross-platform mobile application acting as an active, non-judgmental listening companion. The app will use voice interaction to allow users to vent or chat, responding with active listening cues and providing jokes/quotes on request.

## User Review Required
> [!IMPORTANT]
> **Tech Stack Selection**:
> - **Backend**: Python (FastAPI) hosted on **Google Cloud Run**. Python is chosen for seamless integration with Vertex AI and Google Cloud libraries.
> - **Mobile App**: **React Native (Expo)** for cross-platform (iOS/Android) development.
> - **Database**: **Google Cloud Firestore** for storing user profiles and static content (jokes/quotes). Voice conversations are **NOT** stored.
> - **TTS**: **ElevenLabs** API as requested.
> - **STT**: **Google Cloud Speech-to-Text** as requested.
> - **LLM**: **Vertex AI** (Gemini) for core logic.

> [!WARNING]
> **Cost Implications**: Using ElevenLabs and Google Cloud Services (Vertex AI, STT) will incur costs. Ensure billing is enabled on the GCP project.

## Proposed Changes

### Backend (GCP)
#### [NEW] [main.py](file:///d:/vibeCodeproject/sunoji_hackathon/backend/main.py)
- Entry point for the FastAPI application.
- Endpoints for:
    - `/chat`: Handles voice/text input, processes with STT (if voice), sends to LLM, and returns audio (TTS) or text.
    - `/joke`: Returns a random joke.
    - `/quote`: Returns a random quote.

#### [NEW] [services.py](file:///d:/vibeCodeproject/sunoji_hackathon/backend/services.py)
- `transcribe_audio(audio_content)`: Uses Google Cloud STT.
- `generate_response(text)`: Uses Vertex AI with system prompt for active listening and safety filters.
- `synthesize_speech(text)`: Uses ElevenLabs API.

#### [NEW] [requirements.txt](file:///d:/vibeCodeproject/sunoji_hackathon/backend/requirements.txt)
- Dependencies: `fastapi`, `uvicorn`, `google-cloud-speech`, `google-cloud-aiplatform`, `google-cloud-firestore`, `elevenlabs`.

### Mobile App (React Native)
#### [NEW] [App.js](file:///d:/vibeCodeproject/sunoji_hackathon/mobile/App.js)
- Main application component.
- UI with a simple, calming design (e.g., a listening circle animation).
- Microphone permission handling and recording logic.
- Audio playback logic.

#### [NEW] [api.js](file:///d:/vibeCodeproject/sunoji_hackathon/mobile/api.js)
- Functions to communicate with the backend API.

## Verification Plan

### Automated Tests
- **Backend Tests**: Unit tests for `services.py` mocking external APIs.
- **API Tests**: Test FastAPI endpoints using `TestClient`.

### Manual Verification
- **Safety Test**: Speak sensitive topics (e.g., "I want to hurt myself") and verify the specific refusal message.
- **Latency Test**: Measure time from end of speech to start of audio response.
- **Functionality**: Verify jokes and quotes are returned correctly.
