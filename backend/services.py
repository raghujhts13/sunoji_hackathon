import os
import random
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
import vertexai
from vertexai.generative_models import GenerativeModel
from google.cloud import speech

from elevenlabs.client import ElevenLabs

# Initialize Clients (Lazy initialization recommended in production, but global for simplicity here)
# Note: GCP clients automatically use GOOGLE_APPLICATION_CREDENTIALS
speech_client = speech.SpeechClient()

# Vertex AI Init
PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
LOCATION = os.environ.get("GCP_LOCATION", "us-central1")
if PROJECT_ID:
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    model = GenerativeModel("gemini-pro") # Or gemini-1.5-flash for speed
else:
    model = None # Handle gracefully if env vars missing during dev

# ElevenLabs Init
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else None

# Custom Exceptions
class ServiceError(Exception):
    """Base class for service exceptions."""
    pass

class STTError(ServiceError):
    """Raised when Speech-to-Text fails."""
    pass

class LLMError(ServiceError):
    """Raised when LLM generation fails."""
    pass

class TTSError(ServiceError):
    """Raised when Text-to-Speech fails."""
    pass

async def transcribe_audio(audio_content: bytes) -> str:
    """
    Transcribes audio content using Google Cloud Speech-to-Text.
    """
    try:
        if not audio_content:
            raise ValueError("Audio content is empty")

        audio = speech.RecognitionAudio(content=audio_content)
        
        # Configure for typical mobile audio (e.g., from React Native expo-av)
        # We might need to adjust encoding/sample_rate based on what the app sends.
        # For now, assuming LINEAR16 or generic.
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16, # Update based on app input
            sample_rate_hertz=44100, # Update based on app input
            language_code="en-US",
            enable_automatic_punctuation=True,
        )

        # Detects speech in the audio file
        response = speech_client.recognize(config=config, audio=audio)

        if not response.results:
            return ""

        # Concatenate results
        transcript = ""
        for result in response.results:
            transcript += result.alternatives[0].transcript

        return transcript
    except Exception as e:
        raise STTError(f"Failed to transcribe audio: {str(e)}")

async def generate_response(text: str) -> str:
    """
    Generates a response using Vertex AI (Gemini).
    """
    try:
        if not model:
            raise LLMError("Vertex AI model not initialized. Check GCP_PROJECT_ID.")

        # System Prompt / Context
        system_instruction = """
        You are Sunoji, an active, non-judgmental listening companion.
        Your goal is to listen to the user, validate their feelings, and provide short, neutral, and positive affirmations.
        Examples of responses: "Hmm", "Okay", "I hear you", "That sounds tough", "Go on", "Tell me more".
        
        CRITICAL SAFETY RULES:
        If the user mentions topics such as drugs, abuse, suicidal thoughts, violence, race, religion, or ethnicity, you MUST respond with EXACTLY:
        "This is not a topic I am trained on. Sorry."
        Do not provide any other advice or commentary on these topics.
        
        Keep your responses short and conversational. Do not be preachy.
        """
        
        chat = model.start_chat()
        # We send the system instruction as the first part of the context or use the system_instruction param if available in the SDK version.
        # For gemini-pro, we can prepend it to the user message or use the new API.
        # Simulating system prompt by prepending for now to be safe across versions.
        full_prompt = f"{system_instruction}\n\nUser: {text}\nSunoji:"
        
        response = chat.send_message(full_prompt)
        
        return response.text.strip()
    except Exception as e:
        raise LLMError(f"Failed to generate response: {str(e)}")

async def synthesize_speech(text: str) -> bytes:
    """
    Synthesizes speech using ElevenLabs API.
    """
    try:
        if not elevenlabs_client:
             # Fallback for dev without key
            print("ElevenLabs API key missing, returning dummy audio.")
            return b"dummy_audio"

        audio_generator = elevenlabs_client.generate(
            text=text,
            voice="Rachel", # Default voice, can be changed
            model="eleven_monolingual_v1"
        )
        
        # Determine if audio_generator is bytes or iterator
        audio_bytes = b""
        if isinstance(audio_generator, bytes):
            audio_bytes = audio_generator
        else:
            for chunk in audio_generator:
                audio_bytes += chunk
                
        return audio_bytes
    except Exception as e:
        raise TTSError(f"Failed to synthesize speech: {str(e)}")

def get_joke() -> str:
    """Returns a random joke."""
    jokes = [
        "Why don't scientists trust atoms? Because they make up everything!",
        "I told my wife she was drawing her eyebrows too high. She looked surprised.",
        "Why did the scarecrow win an award? Because he was outstanding in his field!",
        "Parallel lines have so much in common. It’s a shame they’ll never meet.",
        "I threw a boomerang a few years ago. I now live in constant fear.",
    ]
    return random.choice(jokes)

def get_quote() -> str:
    """Returns a random quote."""
    quotes = [
        "The only way to do great work is to love what you do. - Steve Jobs",
        "Believe you can and you're halfway there. - Theodore Roosevelt",
        "It does not matter how slowly you go as long as you do not stop. - Confucius",
        "Act as if what you do makes a difference. It does. - William James",
        "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
    ]
    return random.choice(quotes)
