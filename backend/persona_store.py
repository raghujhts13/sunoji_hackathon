"""
In-memory persona storage with CRUD operations.
Provides a default "Cheerful" persona on initialization.
"""
from typing import Dict, List, Optional
from models import Persona


# Default cheerful persona prompt
CHEERFUL_PERSONA_PROMPT = """
You are a cheerful and uplifting AI companion. Your personality is:
- Warm, friendly, and enthusiastic
- Always looking for the positive side of things
- Encouraging and supportive
- Using upbeat language and occasional exclamations
- Responding with energy and genuine interest

When the user shares something:
- Celebrate their wins, no matter how small
- Offer encouragement during challenges
- Keep responses concise but heartfelt
- Use a conversational, friendly tone
"""


class PersonaStore:
    """
    In-memory storage for personas with CRUD operations.
    Thread-safe for basic operations.
    """
    
    def __init__(self):
        self._personas: Dict[str, Persona] = {}
        self._initialize_default_persona()
    
    def _initialize_default_persona(self):
        """Create the default cheerful persona."""
        default_persona = Persona(
            id="default-cheerful",
            name="Cheerful",
            base_prompt=CHEERFUL_PERSONA_PROMPT.strip(),
            voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel - warm female voice
            base_stability=0.4,  # Slightly lower for more expressiveness
            base_similarity_boost=0.75,
            base_style=0.2,  # Some style for cheerful delivery
            is_default=True
        )
        self._personas[default_persona.id] = default_persona
    
    def get_all(self) -> List[Persona]:
        """Get all personas."""
        return list(self._personas.values())
    
    def get(self, persona_id: str) -> Optional[Persona]:
        """Get a specific persona by ID."""
        return self._personas.get(persona_id)
    
    def get_default(self) -> Persona:
        """Get the default persona."""
        for persona in self._personas.values():
            if persona.is_default:
                return persona
        # Fallback: reinitialize if default is missing
        self._initialize_default_persona()
        return self._personas["default-cheerful"]
    
    def create(self, name: str, base_prompt: str, voice_id: Optional[str] = None,
               base_stability: float = 0.5, base_similarity_boost: float = 0.75,
               base_style: float = 0.0) -> Persona:
        """Create a new persona."""
        persona = Persona(
            name=name,
            base_prompt=base_prompt,
            voice_id=voice_id or "21m00Tcm4TlvDq8ikWAM",
            base_stability=base_stability,
            base_similarity_boost=base_similarity_boost,
            base_style=base_style,
            is_default=False
        )
        self._personas[persona.id] = persona
        return persona
    
    def update(self, persona_id: str, **kwargs) -> Optional[Persona]:
        """
        Update an existing persona.
        Cannot change is_default status through update.
        """
        persona = self._personas.get(persona_id)
        if not persona:
            return None
        
        # Prevent modifying default status
        kwargs.pop("is_default", None)
        kwargs.pop("id", None)
        
        for key, value in kwargs.items():
            if hasattr(persona, key):
                setattr(persona, key, value)
        
        return persona
    
    def delete(self, persona_id: str) -> bool:
        """
        Delete a persona.
        All personas including the default can be deleted.
        If the last persona is deleted, a new default will be auto-created.
        """
        persona = self._personas.get(persona_id)
        if not persona:
            return False
        
        del self._personas[persona_id]
        
        # If no personas left, recreate the default
        if len(self._personas) == 0:
            self._initialize_default_persona()
        
        return True


# Global persona store instance
persona_store = PersonaStore()
