import os
import random
import json
import time
import logging
from typing import Optional
from dotenv import load_dotenv

# Setup logger
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()
import vertexai
from vertexai.generative_models import GenerativeModel
from google.cloud import speech

from elevenlabs.client import ElevenLabs

from models import Persona, IntentToneAnalysis, VALID_INTENTS, VALID_TONES
from persona_store import persona_store
from custom_responses import custom_response_selector

# Initialize Clients
speech_client = speech.SpeechClient()

# Vertex AI Init
PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
LOCATION = os.environ.get("GCP_LOCATION", "us-central1")
if PROJECT_ID:
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    model = GenerativeModel("gemini-2.0-flash")  # Using flash for lower latency
    analysis_model = GenerativeModel("gemini-2.0-flash")  # Separate for analysis
else:
    model = None
    analysis_model = None

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

class AnalysisError(ServiceError):
    """Raised when intent/tone analysis fails."""
    pass

class ContentSafetyError(ServiceError):
    """Raised when content safety check fails."""
    pass


async def transcribe_audio(audio_content: bytes) -> str:
    """
    Transcribes audio content using Google Cloud Speech-to-Text.
    Converts WebM to WAV if needed for better compatibility.
    """
    import logging
    import io
    import subprocess
    import tempfile
    logger = logging.getLogger(__name__)
    
    try:
        if not audio_content:
            raise ValueError("Audio content is empty")
        
        logger.info(f"Audio content size: {len(audio_content)} bytes")

        # First, try converting WebM to WAV using ffmpeg for better compatibility
        try:
            logger.info("Converting WebM to WAV using ffmpeg...")
            
            # Write input to temp file
            with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as input_file:
                input_file.write(audio_content)
                input_path = input_file.name
            
            # Create output temp file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as output_file:
                output_path = output_file.name
            
            # Convert using ffmpeg
            result = subprocess.run([
                'ffmpeg', '-i', input_path,
                '-acodec', 'pcm_s16le',  # LINEAR16
                '-ar', '16000',  # 16kHz sample rate
                '-ac', '1',  # Mono
                '-y',  # Overwrite output
                output_path
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                # Read converted audio
                with open(output_path, 'rb') as f:
                    wav_content = f.read()
                
                logger.info(f"Conversion successful. WAV size: {len(wav_content)} bytes")
                
                # Clean up temp files
                import os
                os.unlink(input_path)
                os.unlink(output_path)
                
                # Use converted audio
                audio = speech.RecognitionAudio(content=wav_content)
                config = speech.RecognitionConfig(
                    encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                    sample_rate_hertz=16000,
                    language_code="en-US",
                    enable_automatic_punctuation=True,
                )
                
                logger.info("Attempting transcription with LINEAR16 (converted WAV)...")
                response = speech_client.recognize(config=config, audio=audio)
                
                if response.results:
                    transcript = ""
                    for result in response.results:
                        transcript += result.alternatives[0].transcript
                    
                    logger.info(f"Transcription successful: '{transcript}'")
                    return transcript
                else:
                    logger.warning("No transcription results from converted WAV")
            else:
                logger.warning(f"ffmpeg conversion failed: {result.stderr}")
                
        except FileNotFoundError:
            logger.warning("ffmpeg not found, falling back to direct WebM transcription")
        except Exception as conv_error:
            logger.warning(f"Audio conversion failed: {str(conv_error)}")
        
        # Fallback: Try direct WEBM_OPUS transcription
        audio = speech.RecognitionAudio(content=audio_content)
        
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
            language_code="en-US",
            enable_automatic_punctuation=True,
        )
        
        logger.info("Attempting transcription with WEBM_OPUS encoding...")
        try:
            response = speech_client.recognize(config=config, audio=audio)
            
            if not response.results:
                logger.warning("No transcription results returned")
                logger.warning(f"Full response object: {response}")
                logger.warning("This usually means no speech was detected in the audio")
                return ""

            transcript = ""
            for result in response.results:
                transcript += result.alternatives[0].transcript
            
            logger.info(f"Transcription successful: '{transcript}'")
            return transcript
            
        except Exception as webm_error:
            import traceback
            logger.error(f"WEBM_OPUS transcription failed with error: {str(webm_error)}")
            logger.error(f"Error type: {type(webm_error).__name__}")
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            logger.info("Trying with encoding auto-detection...")
            
            # Final fallback: Try with encoding auto-detection
            config_auto = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED,
                language_code="en-US",
                enable_automatic_punctuation=True,
            )
            
            response = speech_client.recognize(config=config_auto, audio=audio)
            
            if not response.results:
                logger.warning("No transcription results with auto-detection")
                logger.warning(f"Full response object: {response}")
                return ""

            transcript = ""
            for result in response.results:
                transcript += result.alternatives[0].transcript
            
            logger.info(f"Transcription successful with auto-detection: '{transcript}'")
            return transcript
            
    except Exception as e:
        import traceback
        logger.error(f"Transcription failed completely: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        raise STTError(f"Failed to transcribe audio: {str(e)}")


async def analyze_intent_and_tone(transcript: str) -> IntentToneAnalysis:
    """
    Uses Vertex AI Gemini to analyze user intent and emotional tone.
    Optimized for low latency with structured output.
    """
    try:
        if not analysis_model:
            # Fallback if model not initialized
            return IntentToneAnalysis(
                transcript=transcript,
                intent="casual_chat",
                tone="neutral",
                confidence=0.5
            )
        
        if not transcript.strip():
            return IntentToneAnalysis(
                transcript=transcript,
                intent="casual_chat",
                tone="neutral",
                confidence=0.0
            )
        
        analysis_prompt = f"""Analyze the user's message using Natural Language Understanding to determine their TRUE intent and emotional tone based on semantic meaning, not just keywords.

User said: "{transcript}"

SEMANTIC ANALYSIS GUIDELINES:
- "I want X" / "Looking forward to X" / "Can't wait for X" → excited/happy (anticipation, desire)
- "I don't want X" / "I hate X" / "This sucks" → frustrated/sad (complaints, negativity)
- Mentioning events/competitions/plans → excited (unless explicitly negative)
- Sharing achievements/news → happy/excited
- Complaining/problems → frustrated/sad
- Questions about self → seeking_advice or anxious
- Factual questions → question intent, neutral tone

EXAMPLES:
- "I want the competition today" → excited, casual_chat (anticipation of event)
- "Hey, competition today" → excited, casual_chat (sharing exciting news)
- "I can't handle this competition" → anxious/frustrated, venting (stress)
- "Competition got cancelled" → sad/frustrated, venting (disappointment)
- "What's the weather like?" → neutral, question (factual query)

Classify:
1. intent: One of [venting, seeking_advice, casual_chat, question]
   - venting: expressing frustration, complaints, negative emotions
   - seeking_advice: asking for guidance or help with decisions
   - casual_chat: sharing news, updates, greetings, positive statements
   - question: asking for information or facts

2. tone: One of [happy, sad, frustrated, neutral, anxious, excited]
   - happy: positive, joyful, content, satisfied
   - sad: melancholic, disappointed, down
   - frustrated: annoyed, irritated, complaining
   - neutral: calm, matter-of-fact, informational
   - anxious: worried, nervous, uncertain, stressed
   - excited: enthusiastic, eager, anticipating, energized

IMPORTANT: Focus on the SEMANTIC MEANING and CONTEXT, not surface keywords.

Respond ONLY with a JSON object like:
{{"intent": "...", "tone": "...", "confidence": 0.0-1.0}}"""

        start_time = time.time()
        response = analysis_model.generate_content(analysis_prompt)
        elapsed = time.time() - start_time
        
        # Parse JSON response
        response_text = response.text.strip()
        # Handle potential markdown code blocks
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        result = json.loads(response_text.strip())
        
        # Validate and sanitize
        intent = result.get("intent", "casual_chat")
        if intent not in VALID_INTENTS:
            intent = "casual_chat"
        
        tone = result.get("tone", "neutral")
        if tone not in VALID_TONES:
            tone = "neutral"
        
        confidence = float(result.get("confidence", 0.7))
        
        return IntentToneAnalysis(
            transcript=transcript,
            intent=intent,
            tone=tone,
            confidence=min(max(confidence, 0.0), 1.0)
        )
        
    except json.JSONDecodeError:
        # Fallback on parse error
        return IntentToneAnalysis(
            transcript=transcript,
            intent="casual_chat",
            tone="neutral",
            confidence=0.3
        )
    except Exception as e:
        raise AnalysisError(f"Failed to analyze intent/tone: {str(e)}")


def compute_voice_settings(persona: Persona, analysis: IntentToneAnalysis) -> dict:
    """
    Computes dynamic ElevenLabs voice settings based on persona and analysis.
    
    Strategy:
    - Base settings come from persona
    - Modulate based on detected user tone for appropriate response
    - Cheerful personas get more style, calm personas get more stability
    """
    # Start with persona's base settings
    stability = persona.base_stability
    similarity_boost = persona.base_similarity_boost
    style = persona.base_style
    
    # Modulate based on user's emotional state
    tone_adjustments = {
        "happy": {"stability": -0.1, "style": 0.1},      # More expressive for happy users
        "sad": {"stability": 0.15, "style": -0.05},      # Calmer, more stable for sad users
        "frustrated": {"stability": 0.1, "style": 0.0},   # Stable but present
        "neutral": {"stability": 0.0, "style": 0.0},      # No adjustment
        "anxious": {"stability": 0.15, "style": -0.1},    # Very calm and stable
        "excited": {"stability": -0.15, "style": 0.15},   # Match their energy
    }
    
    adjustments = tone_adjustments.get(analysis.tone, {"stability": 0.0, "style": 0.0})
    
    # Apply adjustments with bounds
    stability = max(0.1, min(0.9, stability + adjustments["stability"]))
    style = max(0.0, min(0.5, style + adjustments["style"]))
    
    # Intent-based minor adjustments
    if analysis.intent == "venting":
        # User is venting - be a supportive listener, calm voice
        stability = min(stability + 0.05, 0.9)
    elif analysis.intent == "question":
        # User asking question - clear, articulate response
        stability = max(stability, 0.5)
    
    return {
        "stability": round(stability, 2),
        "similarity_boost": round(similarity_boost, 2),
        "style": round(style, 2)
    }


async def extract_location_from_query(transcript: str) -> Optional[str]:
    """
    Use LLM to extract a location name from a weather query.
    
    Args:
        transcript: The user's speech transcript
    
    Returns:
        Location name string or None if no location mentioned
    """
    try:
        if not analysis_model:
            return None
        
        extraction_prompt = f"""Extract the location/place name from this weather-related query.
If no specific location is mentioned, respond with exactly: NONE
If a location is mentioned, respond with ONLY the location name, nothing else.

Query: "{transcript}"

Location:"""
        
        response = analysis_model.generate_content(extraction_prompt)
        result = response.text.strip()
        
        if result.upper() == "NONE" or not result:
            return None
        
        return result
    except Exception as e:
        logger.warning(f"Failed to extract location from query: {e}")
        return None


# COMMENTED OUT: Weather query detection
# def is_weather_query(transcript: str) -> bool:
#     """Check if transcript is asking about weather."""
#     weather_keywords = ["weather", "temperature", "hot", "cold", "rain", "sunny", "forecast"]
#     return any(keyword in transcript.lower() for keyword in weather_keywords)

# COMMENTED OUT: Time query detection
# def is_time_query(transcript: str) -> bool:
#     """Check if transcript is asking about time or date."""
#     time_keywords = ["time", "date", "what day", "clock", "hour", "minute", "today", "day is it"]
#     return any(keyword in transcript.lower() for keyword in time_keywords)


async def generate_response(
    transcript: str,
    persona: Persona,
    analysis: IntentToneAnalysis,
    weather_data:Optional[dict] = None,
    time_data: Optional[dict] = None,
    is_first_interaction: bool = False,
    time_of_day: Optional[str] = None
) -> str:
    """
    Uses LLM as a router to select the most appropriate response phrase from customResponses.txt.
    Returns only the selected phrase to be voiced via ElevenLabs.
    """
    try:
        if not model:
            raise LLMError("Vertex AI model not initialized. Check GCP_PROJECT_ID.")

        # Get all available phrases from custom_response_selector
        available_phrases = []
        for category, phrases in custom_response_selector.phrases.items():
            available_phrases.extend(phrases)
        
        # Build a prompt for LLM to select the best phrase
        selection_prompt = f"""You are an empathetic response selector for a warm AI companion. Select the MOST APPROPRIATE acknowledgment phrase that matches the user's energy and context.

User's message: "{transcript}"
Detected tone: {analysis.tone}
Detected intent: {analysis.intent}

CONTEXT GUIDELINES:
- Competitions, events, achievements, plans → Use excited/positive phrases (e.g., "Really?", "How exciting", "That's great")
- Sharing news or updates → Use engaged phrases (e.g., "Oh wow", "Tell me more", "That's wonderful")
- Venting or problems → Use validating phrases (e.g., "I hear you", "That sounds tough")
- Thinking/processing → Use patient phrases (e.g., "Take your time", "I'm listening")
- Simple greetings → Use warm acknowledgments (e.g., "I'm here", "Go on")

IMPORTANT: Match the user's implicit energy level, not just the detected tone. Be warm and engaged.

Available phrases:
{chr(10).join(f"{i+1}. {phrase}" for i, phrase in enumerate(available_phrases))}

Select ONE phrase that feels natural and matches their energy. Respond with ONLY the exact phrase text, nothing else.

Selected phrase:"""
        
        chat = model.start_chat()
        response = chat.send_message(selection_prompt)
        
        selected_phrase = response.text.strip()
        
        # Fallback: if LLM returns something not in our list, use custom_response_selector logic
        if selected_phrase not in available_phrases:
            logger.warning(f"LLM returned phrase not in list: '{selected_phrase}'. Using fallback.")
            selected_phrase = custom_response_selector.select_phrase(analysis.tone, analysis.intent)
        
        logger.info(f"Selected phrase for tone={analysis.tone}, intent={analysis.intent}: '{selected_phrase}'")
        return selected_phrase
        
    except Exception as e:
        # Fallback to custom_response_selector on any error
        logger.error(f"Error in LLM-based phrase selection: {str(e)}. Using fallback.")
        return custom_response_selector.select_phrase(analysis.tone, analysis.intent)


# COMMENTED OUT: Original full response generation function
# async def generate_response_ORIGINAL(
#     transcript: str,
#     persona: Persona,
#     analysis: IntentToneAnalysis,
#     weather_data:Optional[dict] = None,
#     time_data: Optional[dict] = None,
#     is_first_interaction: bool = False,
#     time_of_day: Optional[str] = None
# ) -> str:
#     """
#     Generates a response using Vertex AI with persona and analysis context.
#     Enhanced to handle weather queries and time queries.
#     Adds simple time-based greeting (Good morning/afternoon/evening/night) on first interaction.
#     """
#     try:
#         if not model:
#             raise LLMError("Vertex AI model not initialized. Check GCP_PROJECT_ID.")
#
#         # Build context-aware system prompt
#         context_hints = []
#         
#         # First interaction - add simple greeting instruction  
#         if is_first_interaction and time_of_day:
#             greeting_map = {
#                 "morning": "Good morning",
#                 "afternoon": "Good afternoon",
#                 "evening": "Good evening",
#                 "night": "Good night"
#             }
#             greeting = greeting_map.get(time_of_day, "Hello")
#             context_hints.append(f"This is the first interaction. Start your response with '{greeting}' (just those two words), then naturally respond to their query.")
#         
#         # Intent-based context
#         if analysis.intent == "venting":
#             context_hints.append("The user is venting and needs to feel heard. Validate their feelings.")
#         elif analysis.intent == "seeking_advice":
#             context_hints.append("The user is seeking advice. Offer thoughtful guidance.")
#         elif analysis.intent == "question":
#             context_hints.append("The user asked a question. Provide a helpful answer.")
#         
#         # Tone-based context
#         if analysis.tone in ["sad", "anxious"]:
#             context_hints.append("The user seems emotionally vulnerable. Be extra gentle and supportive.")
#         elif analysis.tone in ["happy", "excited"]:
#             context_hints.append("The user is in a positive mood. Match their energy!")
#         elif analysis.tone == "frustrated":
#             context_hints.append("The user seems frustrated. Acknowledge their frustration and be patient.")
#         
#         context_section = "\n".join(context_hints) if context_hints else ""
#         
#         # Special handling for weather queries
#         if is_weather_query(transcript):
#             if weather_data and weather_data.get("success"):
#                 # We have weather data - provide it
#                 temp = weather_data.get("temperature")
#                 feels_like = weather_data.get("apparent_temperature")
#                 conditions = weather_data.get("conditions")
#                 location = weather_data.get("location_name", "your location")
#                 humidity = weather_data.get("humidity")
#                 wind = weather_data.get("wind_speed")
#                 
#                 weather_context = f"""The user is asking about weather. Here's the current data for {location}:
# - Temperature: {temp}°C (feels like {feels_like}°C)
# - Conditions: {conditions}
# - Humidity: {humidity}%
# - Wind speed: {wind} km/h
#
# Provide this weather information in your personality style, keeping it natural and conversational."""
#                 context_section = f"{context_section}\n\n{weather_context}" if context_section else weather_context
#             else:
#                 # Weather query but no data available - ask for location
#                 weather_context = """The user is asking about weather, but no location was specified or found. 
# Politely ask them which location/city they'd like to know the weather for."""
#                 context_section = f"{context_section}\n\n{weather_context}" if context_section else weather_context
#         
#         # Special handling for time queries
#         if is_time_query(transcript) and time_data:
#             time_context = f"""The user is asking about the time/date. Current information:
# - Time: {time_data.get("time", "N/A")}
# - Date: {time_data.get("date", "N/A")}
# - Day: {time_data.get("day_of_week", "N/A")}
#
# Provide this time information in your personality style, keeping it natural and conversational."""
#             context_section = f"{context_section}\n\n{time_context}" if context_section else time_context
#         
#         full_prompt = f"""{persona.base_prompt}
#
# {context_section}
#
# Keep your response concise and conversational (1-3 sentences).
#
# User: {transcript}
# Assistant:"""
#         
#         chat = model.start_chat()
#         response = chat.send_message(full_prompt)
#         
#         ai_response = response.text.strip()
#         
#         # Select appropriate custom phrase based on tone and intent
#         custom_phrase = custom_response_selector.select_phrase(analysis.tone, analysis.intent)
#         
#         # Prepend the custom phrase to the response (except for first interaction with greeting)
#         if is_first_interaction and time_of_day:
#             # For first interaction, the greeting is already in the response, just add phrase after greeting
#             # The AI already starts with "Good morning/afternoon/etc"
#             return ai_response
#         else:
#             # For subsequent interactions, prepend the custom phrase
#             return f"{custom_phrase}. {ai_response}"
#     except Exception as e:
#         raise LLMError(f"Failed to generate response: {str(e)}")


async def synthesize_speech(
    text: str,
    voice_id: str,
    voice_settings: dict
) -> bytes:
    """
    Synthesizes speech using ElevenLabs API with dynamic voice settings.
    """
    try:
        if not elevenlabs_client:
            print("ElevenLabs API key missing, returning dummy audio.")
            return b"dummy_audio"

        audio_generator = elevenlabs_client.text_to_speech.convert(
            text=text,
            voice_id=voice_id,
            model_id="eleven_turbo_v2_5",  # Faster model for lower latency
            voice_settings={
                "stability": voice_settings.get("stability", 0.5),
                "similarity_boost": voice_settings.get("similarity_boost", 0.75),
                "style": voice_settings.get("style", 0.0),
                "use_speaker_boost": True
            }
        )
        
        # Collect audio bytes
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
        "Parallel lines have so much in common. It's a shame they'll never meet.",
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
