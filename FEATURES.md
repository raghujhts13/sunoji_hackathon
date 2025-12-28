# Sunoji.me - Feature Documentation

This document provides detailed specifications for all features implemented in the Sunoji.me AI Voice Companion application.

---

## Table of Contents

1. [Persona System (FR-1)](#fr-1-persona-system)
2. [Intent & Tone Analysis (FR-2)](#fr-2-intent--tone-analysis)
3. [Dynamic Voice Synthesis (FR-3)](#fr-3-dynamic-voice-synthesis)
4. [Speech-to-Speech Pipeline (FR-4)](#fr-4-speech-to-speech-pipeline)
5. [Frontend Persona Management (FR-5)](#fr-5-frontend-persona-management)
6. [Continuous Listening Mode (FR-6)](#fr-6-continuous-listening-mode)
7. [Content Safety Guardrails](#content-safety-guardrails)
8. [Weather & Time Queries](#weather--time-queries)
9. [Non-Functional Requirements](#non-functional-requirements)

---

## FR-1: Persona System

**Description**: Users can create, manage, and select "personas" - base prompts that define the AI companion's personality and speaking style.

| ID | Requirement | Test Condition |
|----|-------------|----------------|
| FR-1.1 | Default "Cheerful" persona must exist on first launch | Verify database contains cheerful persona with upbeat, positive prompt |
| FR-1.2 | Users can create custom personas with name and base prompt | Create persona → verify stored and retrievable via API |
| FR-1.3 | Users can edit existing personas | Edit persona → verify changes persist |
| FR-1.4 | Users can delete any persona including default | Delete persona → verify removed; if last deleted → new default auto-created |
| FR-1.5 | Users can select active persona for conversations | Select persona → verify subsequent responses use selected persona's prompt |

### Implementation Details

- **Storage**: In-memory dictionary with JSON file persistence
- **Default Persona**: Created automatically if none exist
- **API Endpoints**:
  - `GET /personas` - List all personas
  - `GET /personas/{id}` - Get specific persona
  - `POST /personas` - Create new persona
  - `PUT /personas/{id}` - Update persona
  - `DELETE /personas/{id}` - Delete persona

---

## FR-2: Intent & Tone Analysis

**Description**: The system analyzes user speech for intent (what they want) and tone (how they feel) alongside the exact transcribed phrase.

| ID | Requirement | Test Condition |
|----|-------------|----------------|
| FR-2.1 | Transcribe speech with exact phrase preservation | Send audio → verify transcript matches spoken words |
| FR-2.2 | Detect user intent categories (venting, seeking advice, casual chat, asking question) | Send categorized test phrases → verify correct intent detected |
| FR-2.3 | Detect tone/emotion (happy, sad, frustrated, neutral, anxious, excited) | Send emotionally-toned audio → verify correct tone detected |
| FR-2.4 | Analysis results included in response generation context | Verify LLM prompt includes intent and tone data |
| FR-2.5 | Analysis completes within 200ms on average | Measure analysis latency across 50 samples → verify avg < 200ms |

### Intent Categories

- **venting**: User expressing frustration or negative emotions
- **seeking_advice**: User asking for suggestions or guidance
- **casual_chat**: General conversation without specific purpose
- **question**: Direct question expecting factual answer

### Tone Categories

- **happy** 😊: Positive, upbeat emotional state
- **sad** 😢: Melancholic or down emotional state
- **frustrated** 😤: Annoyed or irritated state
- **neutral** 😐: No strong emotional indicators
- **anxious** 😰: Worried or stressed state
- **excited** 🤩: Highly enthusiastic state

---

## FR-3: Dynamic Voice Synthesis

**Description**: ElevenLabs TTS settings are dynamically adjusted based on analyzed intent, tone, and active persona.

| ID | Requirement | Test Condition |
|----|-------------|----------------|
| FR-3.1 | Voice stability adjusted based on user emotion | Sad user → higher stability (calmer); excited user → lower stability (expressive) |
| FR-3.2 | Voice similarity boost remains consistent for persona identity | Verify similarity_boost parameter stays within 0.7-0.8 range |
| FR-3.3 | Style exaggeration increases for expressive personas | Cheerful persona + happy user → verify style > 0 |
| FR-3.4 | Speaking rate adjusts to match conversational context | Urgent intent → faster speech; emotional support → slower speech |
| FR-3.5 | Persona defines base voice characteristics | Each persona can specify preferred voice_id, base stability, base style |

### Voice Settings Computation

```python
# Base from persona
stability = persona.base_stability
similarity_boost = persona.base_similarity_boost
style = persona.base_style

# Modulate based on user tone
if tone == 'sad':
    stability += 0.1  # Calmer
elif tone == 'excited':
    stability -= 0.1  # More expressive
```

---

## FR-4: Speech-to-Speech Pipeline

**Description**: Complete audio-in, audio-out conversation flow.

| ID | Requirement | Test Condition |
|----|-------------|----------------|
| FR-4.1 | Accept audio input in common web formats (WebM/Opus, WAV) | Send both formats → verify successful processing |
| FR-4.2 | Return audio response in streamable MP3 format | Verify response Content-Type and playback in browser |
| FR-4.3 | Maintain conversation context within session | Multi-turn dialogue → verify AI remembers previous exchanges |
| FR-4.4 | Handle empty/silence audio gracefully | Send silent audio → verify appropriate "I didn't catch that" response |

### Pipeline Flow

1. **Audio Received** → Mobile app sends M4A audio
2. **STT Processing** → Google Cloud Speech-to-Text transcribes
3. **Intent/Tone Analysis** → Gemini analyzes transcript
4. **Content Safety Check** → Detect harmful content
5. **Response Generation** → Gemini generates response with persona context
6. **TTS Synthesis** → ElevenLabs converts to speech
7. **Audio Response** → Base64 MP3 returned to client

---

## FR-5: Frontend Persona Management

**Description**: Mobile UI for managing personas and conversation.

| ID | Requirement | Test Condition |
|----|-------------|----------------|
| FR-5.1 | Display list of available personas | Load page → verify personas displayed |
| FR-5.2 | Form to create new persona | Fill form → submit → verify persona created |
| FR-5.3 | Edit/delete buttons for custom personas | Click edit → modify → save → verify changes |
| FR-5.4 | Visual indicator of selected persona | Select persona → verify UI highlight |
| FR-5.5 | Real-time display of detected intent/tone | After speech → display analysis results before response |

### UI Components

- **PersonaChip**: Horizontal scrollable selector with gradient active state
- **PersonaModal**: Bottom sheet for CRUD operations
- **ChatMessage**: Shows tone/intent badges on user messages

---

## FR-6: Continuous Listening Mode

**Description**: Siri-like always-on listening mode where users start once and the AI listens continuously, detecting speech pauses to respond automatically.

| ID | Requirement | Test Condition |
|----|-------------|----------------|
| FR-6.1 | Single button to start/stop continuous session | Click Start → session begins; Click Stop → session ends |
| FR-6.2 | Voice Activity Detection (VAD) detects speech | Speak → verify audio recording triggers |
| FR-6.3 | Silence detection triggers processing | Pause 1.5s → verify audio sent for processing |
| FR-6.4 | Auto-resume after AI response | AI speaks → verify listening resumes automatically |
| FR-6.5 | Session states displayed clearly | Verify visual states: Listening (green), Processing (spinner), Speaking (blue) |
| FR-6.6 | Multi-turn conversation without restart | 5+ exchanges → verify no manual restart needed |
| FR-6.7 | Brief pauses don't trigger response | Pause 0.5s mid-sentence → verify no response |

### Session States

| State | Visual | Description |
|-------|--------|-------------|
| IDLE | Primary gradient, "Start" | Not listening |
| LISTENING | Green gradient, "Stop" | Actively listening with VAD |
| PROCESSING | Accent gradient, Spinner | Analyzing and generating response |
| RESPONDING | Blue gradient, "Speaking" | Playing AI audio response |

### VAD Parameters

- **Silence Threshold**: -40 dB (expo-av metering)
- **Silence Duration**: 1500ms of silence triggers processing
- **Speech Min Duration**: 300ms minimum speech before silence detection activates

---

## Content Safety Guardrails

**Description**: Psychological safety layer that detects potentially harmful content and provides supportive responses with crisis resources.

### Harm Categories Detected

- **Suicide/Self-Harm**: References to ending one's life or self-injury
- **Discrimination**: Hateful content based on protected characteristics
- **Abuse**: References to being abused or abusing others
- **Violence**: Threats or descriptions of violent acts
- **Substance Abuse**: Discussions of dangerous substance use

### Safety Features

- **Pattern Matching**: Keyword and phrase detection
- **Supportive Responses**: Warm, encouraging messages instead of refusal
- **Crisis Resources**: Relevant helplines and websites based on category
- **Persona-Independent**: Safety cannot be bypassed by custom personas

---

## Weather & Time Queries

### Weather Integration

- **Provider**: Open-Meteo API (free, no API key required)
- **Location Sources**: 
  1. Device GPS coordinates
  2. City name extraction from natural language
- **Data**: Temperature, conditions, humidity, wind speed

### Time Integration

- **Timezone Support**: Configurable, defaults to Asia/Kolkata
- **Time-of-Day Greetings**: Good morning/afternoon/evening/night
- **First Interaction**: Automatic greeting based on time

---

## Non-Functional Requirements

### NFR-1: Latency

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1.1 | End-to-end response time | < 2 seconds (95th percentile) |
| NFR-1.2 | STT processing | < 500ms for < 10s utterance |
| NFR-1.3 | LLM response generation | < 800ms |
| NFR-1.4 | TTS synthesis | First byte < 400ms |

### NFR-2: User Experience

| ID | Requirement |
|----|-------------|
| NFR-2.1 | Premium, modern UI design with smooth animations |
| NFR-2.2 | Clear visual feedback during all processing states |
| NFR-2.3 | Responsive design optimized for mobile |
| NFR-2.4 | Accessible color contrast (>= 4.5:1) and font sizes |

### NFR-3: Reliability

| ID | Requirement |
|----|-------------|
| NFR-3.1 | Graceful error handling with user-friendly messages |
| NFR-3.2 | Automatic retry for transient API failures |
| NFR-3.3 | Session recovery after brief network disruption |

---

## API Endpoints Reference

### Chat
- `POST /chat` - Process audio and return AI response

### Personas
- `GET /personas` - List all personas
- `GET /personas/{id}` - Get persona by ID
- `POST /personas` - Create persona
- `PUT /personas/{id}` - Update persona
- `DELETE /personas/{id}` - Delete persona

### Utilities
- `GET /joke` - Get random joke
- `GET /quote` - Get random quote
- `GET /weather` - Get weather information
- `GET /datetime` - Get current date/time
- `GET /greeting` - Get time-based greeting
- `GET /health` - Health check
