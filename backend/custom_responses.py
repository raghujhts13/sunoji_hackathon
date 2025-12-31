"""
Custom response phrase selector based on customResponses.txt.
Maps user tone/intent to appropriate acknowledgment phrases.
"""
import os
import random
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class CustomResponseSelector:
    """
    Loads and manages custom response phrases from customResponses.txt.
    Selects appropriate phrases based on user tone and intent.
    """
    
    def __init__(self, responses_file_path: str = None):
        if responses_file_path is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            responses_file_path = os.path.join(os.path.dirname(base_dir), "customResponses.txt")
        
        self.responses_file_path = responses_file_path
        self.phrases: Dict[str, List[str]] = {
            "active_listening": [],
            "neutral_acknowledgments": [],
            "validating_responses": [],
            "positive_acknowledgments": [],
            "excited_celebratory": [],
            "thoughtful_pauses": [],
            "encouraging_continuation": [],
            "reflective_acknowledgments": [],
            "empathetic_sounds": []
        }
        self._load_phrases()
    
    def _load_phrases(self):
        """Parse customResponses.txt and load phrases into categories."""
        try:
            with open(self.responses_file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            current_category = None
            category_mapping = {
                "Category 1: Active Listening Signals": "active_listening",
                "Category 2: Neutral Acknowledgments": "neutral_acknowledgments",
                "Category 3: Validating Responses": "validating_responses",
                "Category 4: Positive Acknowledgments": "positive_acknowledgments",
                "Category 5: Excited/Celebratory": "excited_celebratory",
                "Category 6: Thoughtful Pauses": "thoughtful_pauses",
                "Category 7: Encouraging Continuation": "encouraging_continuation",
                "Category 8: Reflective Acknowledgments": "reflective_acknowledgments",
                "Category 9: Empathetic Sounds": "empathetic_sounds"
            }
            
            for line in lines:
                line = line.strip()
                
                # Check if this is a category header
                for header, cat_key in category_mapping.items():
                    if line.startswith(header):
                        current_category = cat_key
                        break
                
                # Stop parsing at Usage Guidelines
                if line.startswith("Usage Guidelines"):
                    break
                
                # Add phrase to current category
                if current_category and line and not line.startswith("Category") and not line.startswith("Use these") and not line.startswith("Non-committal") and not line.startswith("Gentle validation") and not line.startswith("For when") and not line.startswith("For genuinely") and not line.startswith("When user") and not line.startswith("Gentle prompts") and not line.startswith("Showing you're") and not line.startswith("Emotional acknowledgment"):
                    self.phrases[current_category].append(line)
            
            logger.info(f"Loaded custom response phrases: {sum(len(v) for v in self.phrases.values())} total phrases")
            
        except FileNotFoundError:
            logger.error(f"customResponses.txt not found at {self.responses_file_path}")
        except Exception as e:
            logger.error(f"Error loading custom responses: {e}")
    
    def select_phrase(self, tone: str, intent: str) -> str:
        """
        Select an appropriate phrase based on user's tone and intent.
        
        Context-Based Selection (from Usage Guidelines):
        - User is venting/frustrated: Use Categories 1, 3, 6
        - User is sharing good news: Use Categories 4, 5
        - User is thinking/processing: Use Categories 1, 6, 8
        - User is telling a story: Use Categories 1, 2, 7
        - User sounds sad/down: Use Categories 1, 3, 6
        """
        
        # Map tone + intent to appropriate categories
        categories_to_use = []
        
        if tone == "frustrated" or intent == "venting":
            # Venting/frustrated: Active Listening, Validating, Thoughtful Pauses
            categories_to_use = ["active_listening", "validating_responses", "thoughtful_pauses"]
        
        elif tone == "happy":
            # Sharing good news: Positive Acknowledgments, Excited/Celebratory
            categories_to_use = ["positive_acknowledgments", "excited_celebratory"]
        
        elif tone == "sad":
            # Sad/down: Active Listening, Validating, Thoughtful Pauses
            categories_to_use = ["active_listening", "validating_responses", "thoughtful_pauses"]
        
        elif tone == "anxious":
            # Anxious: Active Listening, Validating, Thoughtful Pauses
            categories_to_use = ["active_listening", "validating_responses", "thoughtful_pauses"]
        
        elif tone == "excited":
            # Excited: Positive Acknowledgments, Excited/Celebratory
            categories_to_use = ["positive_acknowledgments", "excited_celebratory"]
        
        elif intent == "question":
            # Question: Neutral Acknowledgments, Reflective
            categories_to_use = ["neutral_acknowledgments", "reflective_acknowledgments"]
        
        elif intent == "casual_chat":
            # Casual chat/story: Active Listening, Neutral, Encouraging
            categories_to_use = ["active_listening", "neutral_acknowledgments", "encouraging_continuation"]
        
        elif intent == "seeking_advice":
            # Seeking advice: Reflective, Neutral, Validating
            categories_to_use = ["reflective_acknowledgments", "neutral_acknowledgments", "validating_responses"]
        
        else:
            # Default: Active Listening and Neutral (high frequency per guidelines)
            categories_to_use = ["active_listening", "neutral_acknowledgments"]
        
        # Collect all phrases from selected categories
        available_phrases = []
        for category in categories_to_use:
            available_phrases.extend(self.phrases.get(category, []))
        
        # Select a random phrase
        if available_phrases:
            return random.choice(available_phrases)
        
        # Fallback to active listening if nothing available
        if self.phrases["active_listening"]:
            return random.choice(self.phrases["active_listening"])
        
        # Final fallback
        return "I hear you"


# Global instance
custom_response_selector = CustomResponseSelector()
