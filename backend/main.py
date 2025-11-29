from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
import logging
from typing import Optional

from services import (
    transcribe_audio,
    generate_response,
    synthesize_speech,
    get_joke,
    get_quote,
    ServiceError,
    STTError,
    LLMError,
    TTSError
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Sunoji.me API", description="Backend for Sunoji.me active listening companion")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatResponse(BaseModel):
    text_response: str
    audio_content: Optional[str] = None # Base64 encoded audio if needed, or raw bytes in a different response type

@app.get("/")
async def health_check():
    return {"status": "healthy"}

@app.post("/chat")
async def chat_endpoint(file: UploadFile = File(...)):
    """
    Receives audio file, transcribes it, generates a response, and returns audio.
    """
    try:
        logger.info(f"Received audio file: {file.filename}")
        audio_content = await file.read()
        
        # 1. Transcribe
        user_text = await transcribe_audio(audio_content)
        logger.info(f"Transcribed text: {user_text}")

        # 2. Generate Response (LLM)
        ai_text = await generate_response(user_text)
        logger.info(f"AI Response: {ai_text}")

        # 3. Synthesize Speech (TTS)
        audio_response = await synthesize_speech(ai_text)
        
        # Return audio directly
        return Response(content=audio_response, media_type="audio/mpeg")

    except STTError as e:
        logger.error(f"STT Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to process speech.")
    except LLMError as e:
        logger.error(f"LLM Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate response.")
    except TTSError as e:
        logger.error(f"TTS Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to synthesize speech.")
    except Exception as e:
        logger.error(f"Unexpected Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

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
