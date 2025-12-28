"""
Data models for the AI Voice Companion application.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import uuid


@dataclass
class Persona:
    """
    Represents a persona - a base prompt configuration that defines
    the AI companion's personality and voice characteristics.
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    base_prompt: str = ""
    voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # Default: Rachel voice
    base_stability: float = 0.5
    base_similarity_boost: float = 0.75
    base_style: float = 0.0
    is_default: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "base_prompt": self.base_prompt,
            "voice_id": self.voice_id,
            "base_stability": self.base_stability,
            "base_similarity_boost": self.base_similarity_boost,
            "base_style": self.base_style,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "Persona":
        """Create Persona from dictionary."""
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            name=data.get("name", ""),
            base_prompt=data.get("base_prompt", ""),
            voice_id=data.get("voice_id", "21m00Tcm4TlvDq8ikWAM"),
            base_stability=data.get("base_stability", 0.5),
            base_similarity_boost=data.get("base_similarity_boost", 0.75),
            base_style=data.get("base_style", 0.0),
            is_default=data.get("is_default", False),
            created_at=datetime.fromisoformat(data["created_at"]) if "created_at" in data else datetime.utcnow()
        )


@dataclass
class IntentToneAnalysis:
    """
    Represents the analyzed intent and tone from user speech.
    """
    transcript: str
    intent: str  # venting, seeking_advice, casual_chat, question
    tone: str    # happy, sad, frustrated, neutral, anxious, excited
    confidence: float = 0.0
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "transcript": self.transcript,
            "intent": self.intent,
            "tone": self.tone,
            "confidence": self.confidence
        }


# Valid intent and tone categories
VALID_INTENTS = ["venting", "seeking_advice", "casual_chat", "question"]
VALID_TONES = ["happy", "sad", "frustrated", "neutral", "anxious", "excited"]
