"""
Content Safety Module

Provides psychological safety guardrails for the AI Voice Companion.
Detects harmful content (suicide, self-harm, discrimination, abuse, violence)
and returns supportive, encouraging responses with crisis resources.

This module operates INDEPENDENTLY of persona settings to ensure safety
cannot be bypassed by custom persona configurations.
"""

import os
import json
import re
from typing import Optional, Tuple, List
from dataclasses import dataclass
from enum import Enum


class HarmCategory(Enum):
    """Categories of harmful content that trigger safety responses."""
    NONE = "none"
    SUICIDE_SELF_HARM = "suicide_self_harm"
    SELF_HARM = "self_harm"
    DISCRIMINATION = "discrimination"
    ABUSE = "abuse"
    VIOLENCE = "violence"
    SUBSTANCE_ABUSE = "substance_abuse"
    GENERAL_HARMFUL = "general_harmful"


@dataclass
class ContentSafetyResult:
    """Result of content safety analysis."""
    is_harmful: bool
    category: HarmCategory
    confidence: float
    requires_crisis_resources: bool
    matched_patterns: List[str]
    
    def to_dict(self) -> dict:
        return {
            "is_harmful": self.is_harmful,
            "category": self.category.value,
            "confidence": self.confidence,
            "requires_crisis_resources": self.requires_crisis_resources,
            "matched_patterns": self.matched_patterns
        }


# Pattern-based detection for immediate safety concerns
# These patterns are designed to catch explicit harmful content
HARM_PATTERNS = {
    HarmCategory.SUICIDE_SELF_HARM: [
        r"\b(want to |wanna |going to |gonna )?(kill myself|end my life|end it all|commit suicide)\b",
        r"\b(suicidal|suicide)\b",
        r"\b(don'?t want to live|don'?t want to be alive|wish i was dead|better off dead)\b",
        r"\b(take my (own )?life|taking my (own )?life)\b",
        r"\b(no reason to live|nothing to live for)\b",
    ],
    HarmCategory.SELF_HARM: [
        r"\b(cut myself|cutting myself|hurt myself|hurting myself)\b",
        r"\b(self[- ]?harm|self[- ]?injury)\b",
        r"\b(burn myself|burning myself|starve myself|starving myself)\b",
    ],
    HarmCategory.DISCRIMINATION: [
        r"\b(hate|kill|eliminate|destroy) (all )?(blacks?|whites?|jews?|muslims?|christians?|hindus?|gays?|lesbians?|trans)\b",
        r"\b(racial slurs detected by context)\b",  # Placeholder - actual slurs not included
        r"\b(those people deserve|they all deserve) (to die|death|suffering)\b",
    ],
    HarmCategory.ABUSE: [
        r"\b(being abused|someone (is )?abusing me|hit me|hits me|beats me)\b",
        r"\b(domestic (violence|abuse)|physical abuse|emotional abuse|sexual abuse)\b",
        r"\b(my (partner|spouse|husband|wife|boyfriend|girlfriend) (hits|beats|hurts) me)\b",
        r"\b(i('m| am) (being|getting) abused)\b",
    ],
    HarmCategory.VIOLENCE: [
        r"\b(want to |wanna |going to |gonna )?(kill|murder|hurt|attack|shoot|stab) (someone|people|them|him|her|everybody)\b",
        r"\b(bring a (gun|weapon|knife) to)\b",
        r"\b(planning (to|a) (attack|shooting|violence))\b",
    ],
    HarmCategory.SUBSTANCE_ABUSE: [
        r"\b(addicted to|addiction to) (drugs?|alcohol|heroin|cocaine|meth|pills?|opioids?)\b",
        r"\b(can'?t stop (using|drinking|taking))\b",
        r"\b(overdose|od'?d|od'?ing)\b",
    ],
}

# Categories that require crisis resources in response
CRISIS_CATEGORIES = {
    HarmCategory.SUICIDE_SELF_HARM,
    HarmCategory.SELF_HARM,
    HarmCategory.ABUSE,
    HarmCategory.VIOLENCE,
}


class ContentSafetyChecker:
    """
    Checks content for harmful patterns and provides supportive responses.
    Crisis resources are loaded from configurable JSON file.
    """
    
    def __init__(self, resources_path: Optional[str] = None):
        """
        Initialize the safety checker.
        
        Args:
            resources_path: Path to crisis_resources.json. 
                          Defaults to same directory as this module.
        """
        if resources_path is None:
            # Check environment variable first
            resources_path = os.environ.get("CRISIS_RESOURCES_PATH")
        
        if resources_path is None:
            # Default to same directory as this module
            module_dir = os.path.dirname(os.path.abspath(__file__))
            resources_path = os.path.join(module_dir, "crisis_resources.json")
        
        self.resources_path = resources_path
        self._resources_cache = None
        self._load_resources()
    
    def _load_resources(self) -> None:
        """Load crisis resources from JSON file."""
        try:
            with open(self.resources_path, 'r', encoding='utf-8') as f:
                self._resources_cache = json.load(f)
        except FileNotFoundError:
            print(f"Warning: Crisis resources file not found at {self.resources_path}")
            self._resources_cache = self._get_default_resources()
        except json.JSONDecodeError as e:
            print(f"Warning: Error parsing crisis resources JSON: {e}")
            self._resources_cache = self._get_default_resources()
    
    def _get_default_resources(self) -> dict:
        """Return minimal default resources if JSON file is unavailable."""
        return {
            "crisis_resources": {
                "suicide_self_harm": {
                    "helplines": [{"name": "Crisis Line", "phone": "988", "description": "24/7 support"}],
                    "websites": [],
                    "emails": []
                }
            },
            "supportive_messages": {
                "suicide_self_harm": "I hear you, and I care about your wellbeing. Please reach out to a crisis helpline for support.",
                "general_harmful": "I'm here for you. Let's focus on finding positive ways forward together."
            }
        }
    
    def reload_resources(self) -> None:
        """Reload resources from file (useful if file is updated)."""
        self._load_resources()
    
    def check_content(self, text: str) -> ContentSafetyResult:
        """
        Analyze text for harmful content.
        
        Args:
            text: User input text to analyze
            
        Returns:
            ContentSafetyResult with detection details
        """
        if not text or not text.strip():
            return ContentSafetyResult(
                is_harmful=False,
                category=HarmCategory.NONE,
                confidence=1.0,
                requires_crisis_resources=False,
                matched_patterns=[]
            )
        
        text_lower = text.lower()
        matched_patterns = []
        detected_category = HarmCategory.NONE
        highest_confidence = 0.0
        
        # Check each harm category
        for category, patterns in HARM_PATTERNS.items():
            for pattern in patterns:
                try:
                    if re.search(pattern, text_lower, re.IGNORECASE):
                        matched_patterns.append(pattern)
                        # Prioritize more severe categories
                        category_priority = {
                            HarmCategory.SUICIDE_SELF_HARM: 1.0,
                            HarmCategory.SELF_HARM: 0.95,
                            HarmCategory.VIOLENCE: 0.9,
                            HarmCategory.ABUSE: 0.85,
                            HarmCategory.DISCRIMINATION: 0.8,
                            HarmCategory.SUBSTANCE_ABUSE: 0.75,
                            HarmCategory.GENERAL_HARMFUL: 0.6,
                        }
                        priority = category_priority.get(category, 0.5)
                        if priority > highest_confidence:
                            highest_confidence = priority
                            detected_category = category
                except re.error:
                    continue
        
        is_harmful = detected_category != HarmCategory.NONE
        requires_crisis = detected_category in CRISIS_CATEGORIES
        
        return ContentSafetyResult(
            is_harmful=is_harmful,
            category=detected_category,
            confidence=highest_confidence if is_harmful else 1.0,
            requires_crisis_resources=requires_crisis,
            matched_patterns=matched_patterns
        )
    
    def get_supportive_response(self, category: HarmCategory) -> str:
        """
        Get a warm, supportive response for the detected harm category.
        
        Args:
            category: The detected harm category
            
        Returns:
            Supportive message string
        """
        messages = self._resources_cache.get("supportive_messages", {})
        
        # Map category to message key
        category_key = category.value
        
        # Get specific message or fallback to general
        message = messages.get(category_key, messages.get("general_harmful", 
            "I'm here for you. Whatever you're going through, there are people who care."))
        
        return message
    
    def get_crisis_resources(self, category: HarmCategory) -> dict:
        """
        Get crisis resources for the detected harm category.
        
        Args:
            category: The detected harm category
            
        Returns:
            Dictionary with helplines, websites, and emails
        """
        resources = self._resources_cache.get("crisis_resources", {})
        
        # Map categories to resource keys
        category_mapping = {
            HarmCategory.SUICIDE_SELF_HARM: "suicide_self_harm",
            HarmCategory.SELF_HARM: "suicide_self_harm",
            HarmCategory.ABUSE: "abuse",
            HarmCategory.VIOLENCE: "general_support",
            HarmCategory.SUBSTANCE_ABUSE: "general_support",
        }
        
        resource_key = category_mapping.get(category, "general_support")
        return resources.get(resource_key, {"helplines": [], "websites": [], "emails": []})
    
    def format_response_with_resources(self, category: HarmCategory) -> str:
        """
        Get complete supportive response with crisis resources if applicable.
        
        Args:
            category: The detected harm category
            
        Returns:
            Complete supportive response with resources
        """
        base_message = self.get_supportive_response(category)
        
        if category not in CRISIS_CATEGORIES:
            return base_message
        
        resources = self.get_crisis_resources(category)
        helplines = resources.get("helplines", [])
        
        if helplines:
            # Add primary helpline to response
            primary = helplines[0]
            resource_text = f"\n\nYou can reach out to {primary['name']} at {primary['phone']}. {primary.get('description', '')}"
            return base_message + resource_text
        
        return base_message


# Global instance for use across the application
_safety_checker: Optional[ContentSafetyChecker] = None


def get_safety_checker() -> ContentSafetyChecker:
    """Get or create the global safety checker instance."""
    global _safety_checker
    if _safety_checker is None:
        _safety_checker = ContentSafetyChecker()
    return _safety_checker


def check_content_safety(text: str) -> ContentSafetyResult:
    """
    Convenience function to check content safety.
    
    Args:
        text: User input text to analyze
        
    Returns:
        ContentSafetyResult with detection details
    """
    return get_safety_checker().check_content(text)


def get_supportive_response(category: HarmCategory) -> str:
    """
    Convenience function to get supportive response.
    
    Args:
        category: The detected harm category
        
    Returns:
        Supportive message string with resources if applicable
    """
    return get_safety_checker().format_response_with_resources(category)
