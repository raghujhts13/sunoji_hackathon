from fastapi import FastAPI, UploadFile, File, HTTPException, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
import logging
import base64
from typing import Optional

from services import (
    transcribe_audio,
    generate_response,
    synthesize_speech,
    analyze_intent_and_tone,
    compute_voice_settings,
    get_joke,
    get_quote,
    ServiceError,
    STTError,
    LLMError,
    TTSError,
    AnalysisError,
    ContentSafetyError
)
from content_safety import check_content_safety, get_supportive_response, HarmCategory
from persona_store import persona_store
from models import Persona

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Voice Companion API",
    description="Low-latency speech-to-speech AI companion with persona support"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic Models
class ChatResponse(BaseModel):
    audio_base64: str
    transcript: str
    intent: str
    tone: str
    response_text: str
    confidence: float
    is_safety_response: bool = False
    safety_category: Optional[str] = None


@app.get("/")
async def health_check():
    return {"status": "healthy", "version": "2.0"}


# ==================== CHAT ENDPOINT ====================

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    file: UploadFile = File(...),
    user_latitude: Optional[float] = Form(default=None),
    user_longitude: Optional[float] = Form(default=None),
    is_first_message: Optional[bool] = Form(default=False)
):
    """
    Process speech input and return AI voice response.
    
    Pipeline:
    1. Transcribe audio (STT)
    2. Analyze intent and tone
    3. Generate response using customResponses.txt tone matching (with weather/time data if queried)
    4. Synthesize speech with dynamic voice settings (TTS)
    
    Optional: user_latitude and user_longitude for weather queries without specific location.
    
    Returns JSON with audio (base64), transcript, analysis, and response text.
    """
    try:
        logger.info(f"Received audio file: {file.filename}, coords: ({user_latitude}, {user_longitude})")
        audio_content = await file.read()
        
        # Get default persona
        persona = persona_store.get_default()
        
        logger.info(f"Using AI Companion")
        
        # 1. Transcribe
        transcript = await transcribe_audio(audio_content)
        logger.info(f"Transcribed text: {transcript}")
        
        if not transcript.strip():
            # Handle empty transcription
            return ChatResponse(
                audio_base64="",
                transcript="",
                intent="casual_chat",
                tone="neutral",
                response_text="I didn't quite catch that. Could you say that again?",
                confidence=0.0
            )
        
        # 2. SAFETY CHECK - Check for harmful content BEFORE normal processing
        # This runs independently of persona to ensure safety cannot be bypassed
        safety_result = check_content_safety(transcript)
        logger.info(f"Safety check - Harmful: {safety_result.is_harmful}, Category: {safety_result.category.value}")
        
        if safety_result.is_harmful:
            # Get supportive response with crisis resources if applicable
            supportive_text = get_supportive_response(safety_result.category)
            logger.info(f"Safety response triggered: {safety_result.category.value}")
            
            # Use calm, supportive voice settings for safety responses
            safety_voice_settings = {
                "stability": 0.7,  # High stability for calm delivery
                "similarity_boost": 0.75,
                "style": 0.1  # Minimal style for sincere tone
            }
            
            # Synthesize the supportive response
            audio_response = await synthesize_speech(supportive_text, persona.voice_id, safety_voice_settings)
            audio_base64 = base64.b64encode(audio_response).decode("utf-8")
            
            return ChatResponse(
                audio_base64=audio_base64,
                transcript=transcript,
                intent="seeking_advice",  # Treat as seeking support
                tone="anxious" if safety_result.category in [HarmCategory.SUICIDE_SELF_HARM, HarmCategory.SELF_HARM] else "frustrated",
                response_text=supportive_text,
                confidence=safety_result.confidence,
                is_safety_response=True,
                safety_category=safety_result.category.value
            )
        
        # 3. Analyze intent and tone (only for non-harmful content)
        analysis = await analyze_intent_and_tone(transcript)
        logger.info(f"Analysis - Intent: {analysis.intent}, Tone: {analysis.tone}")
        
        # COMMENTED OUT: Weather and time data preparation
        # weather_data = None
        # time_data = None
        # 
        # # Check for weather query and fetch data if needed
        # if is_weather_query(transcript):
        #     logger.info("Weather query detected, extracting location...")
        #     location = await extract_location_from_query(transcript)
        #     
        #     if location:
        #         logger.info(f"Location extracted: {location}")
        #         geo_result = geocode_location(location)
        #         if geo_result:
        #             lat, lng, location_name = geo_result
        #             weather_data = await get_weather(lat, lng)
        #             weather_data["location_name"] = location_name or location
        #             logger.info(f"Weather data fetched for {location_name}")
        #         else:
        #             logger.warning(f"Could not geocode location: {location}")
        #     elif user_latitude is not None and user_longitude is not None:
        #         # No specific location mentioned BUT user coords available - use them
        #         logger.info(f"No location specified, using user coordinates: ({user_latitude}, {user_longitude})")
        #         weather_data = await get_weather(user_latitude, user_longitude)
        #         weather_data["location_name"] = "your location"
        #         logger.info(f"Weather data fetched for user's location")
        #     else:
        #         # No specific location mentioned AND no user coords - ask for location
        #         logger.info("No location specified and no user coordinates available")
        # 
        # # Check for time/date query and get time data if needed
        # if is_time_query(transcript):
        #     logger.info("Time/date query detected, fetching current time...")
        #     time_data = get_current_datetime("Asia/Kolkata")
        #     time_data["time_of_day"] = get_time_of_day(time_data["hour"])
        
        # COMMENTED OUT: Time of day greeting
        # current_time_of_day = None
        # if is_first_message:
        #     dt_info = get_current_datetime("Asia/Kolkata")
        #     current_time_of_day = get_time_of_day(dt_info["hour"])
        #     logger.info(f"First message - will greet with time of day: {current_time_of_day}")
        
        # 4. Generate Response - LLM selects phrase from customResponses.txt
        ai_text = await generate_response(
            transcript, 
            persona, 
            analysis,
            weather_data=None,
            time_data=None,
            is_first_interaction=is_first_message,
            time_of_day=None
        )
        logger.info(f"AI Response: {ai_text}")
        
        # 4. Compute dynamic voice settings
        voice_settings = compute_voice_settings(persona, analysis)
        logger.info(f"Voice settings: {voice_settings}")
        
        # 5. Synthesize Speech (TTS)
        audio_response = await synthesize_speech(ai_text, persona.voice_id, voice_settings)
        
        # Encode audio as base64
        audio_base64 = base64.b64encode(audio_response).decode("utf-8")
        
        return ChatResponse(
            audio_base64=audio_base64,
            transcript=analysis.transcript,
            intent=analysis.intent,
            tone=analysis.tone,
            response_text=ai_text,
            confidence=analysis.confidence
        )

    except STTError as e:
        logger.error(f"STT Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to process speech.")
    except AnalysisError as e:
        logger.error(f"Analysis Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to analyze speech.")
    except LLMError as e:
        logger.error(f"LLM Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate response.")
    except TTSError as e:
        logger.error(f"TTS Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to synthesize speech.")
    except Exception as e:
        logger.error(f"Unexpected Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


# ==================== UTILITY ENDPOINTS ====================

@app.get("/joke")
async def joke_endpoint():
    try:
        joke = get_joke()
        return {"joke": joke}
    except Exception as e:
        logger.error(f"Error fetching joke: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get joke.")


@app.get("/quote")
async def quote_endpoint():
    try:
        quote = get_quote()
        return {"quote": quote}
    except Exception as e:
        logger.error(f"Error fetching quote: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get quote.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
