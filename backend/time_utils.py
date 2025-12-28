"""
Date/time utilities for the AI Voice Companion.
Provides time-of-day detection and persona-appropriate greetings.
"""
from datetime import datetime
from typing import Optional
import pytz
import logging

logger = logging.getLogger(__name__)


def get_current_datetime(timezone: str = "UTC") -> dict:
    """
    Get the current date and time in the specified timezone.
    
    Args:
        timezone: IANA timezone string (e.g., "Asia/Kolkata", "America/New_York")
    
    Returns:
        Dictionary with formatted date/time information
    """
    try:
        tz = pytz.timezone(timezone)
    except pytz.exceptions.UnknownTimeZoneError:
        logger.warning(f"Unknown timezone '{timezone}', using UTC")
        tz = pytz.UTC
    
    now = datetime.now(tz)
    
    return {
        "timezone": timezone,
        "datetime_iso": now.isoformat(),
        "date": now.strftime("%A, %B %d, %Y"),  # "Tuesday, December 10, 2024"
        "time": now.strftime("%I:%M %p"),  # "04:30 PM"
        "time_24h": now.strftime("%H:%M"),  # "16:30"
        "hour": now.hour,
        "day_of_week": now.strftime("%A"),
        "month": now.strftime("%B"),
        "year": now.year
    }


def get_time_of_day(hour: Optional[int] = None, timezone: str = "UTC") -> str:
    """
    Determine the time of day based on the hour.
    
    Args:
        hour: Hour in 24-hour format (0-23). If None, uses current hour.
        timezone: IANA timezone string if hour is None
    
    Returns:
        One of: "morning", "afternoon", "evening", "night"
    
    Time ranges:
        - Morning: 5:00 AM - 11:59 AM (5-11)
        - Afternoon: 12:00 PM - 4:59 PM (12-16)
        - Evening: 5:00 PM - 8:59 PM (17-20)
        - Night: 9:00 PM - 4:59 AM (21-23, 0-4)
    """
    if hour is None:
        try:
            tz = pytz.timezone(timezone)
        except pytz.exceptions.UnknownTimeZoneError:
            tz = pytz.UTC
        hour = datetime.now(tz).hour
    
    if 5 <= hour <= 11:
        return "morning"
    elif 12 <= hour <= 16:
        return "afternoon"
    elif 17 <= hour <= 20:
        return "evening"
    else:  # 21-23, 0-4
        return "night"


def get_greeting(time_of_day: str, persona_style: str = "cheerful") -> str:
    """
    Get a time-appropriate greeting based on persona style.
    
    Args:
        time_of_day: One of "morning", "afternoon", "evening", "night"
        persona_style: One of "cheerful", "calm", "professional", "casual"
    
    Returns:
        A greeting string appropriate for the time and persona
    """
    greetings = {
        "cheerful": {
            "morning": "Good morning, sunshine! ☀️ Ready to seize the day?",
            "afternoon": "Hey there! Hope your afternoon is going great! 🌟",
            "evening": "Good evening! 🌅 Hope you had an amazing day!",
            "night": "Hey night owl! 🌙 What's on your mind?"
        },
        "calm": {
            "morning": "Good morning. I hope you rested well.",
            "afternoon": "Good afternoon. How has your day been so far?",
            "evening": "Good evening. It's nice to connect with you.",
            "night": "Good night. I'm here if you need to talk."
        },
        "professional": {
            "morning": "Good morning. How may I assist you today?",
            "afternoon": "Good afternoon. What can I help you with?",
            "evening": "Good evening. I'm at your service.",
            "night": "Good evening. How can I be of assistance?"
        },
        "casual": {
            "morning": "Morning! What's up?",
            "afternoon": "Hey! How's your day going?",
            "evening": "Hey there! How's it going?",
            "night": "Hey! Can't sleep either, huh?"
        }
    }
    
    style_greetings = greetings.get(persona_style, greetings["cheerful"])
    return style_greetings.get(time_of_day, style_greetings["morning"])


def format_datetime_response(
    datetime_info: dict,
    time_of_day: str,
    persona_style: str = "cheerful"
) -> str:
    """
    Format date/time information into a natural language response.
    
    Args:
        datetime_info: Dictionary from get_current_datetime()
        time_of_day: Time of day string
        persona_style: Persona style for formatting
    
    Returns:
        Formatted date/time response string
    """
    date_str = datetime_info.get("date", "today")
    time_str = datetime_info.get("time", "now")
    
    responses = {
        "cheerful": f"It's {time_str} on {date_str}! ⏰ Time flies when you're having fun, right? 🎉",
        "calm": f"The current time is {time_str}. Today is {date_str}.",
        "professional": f"Current time: {time_str}. Date: {date_str}.",
        "casual": f"It's {time_str}, {date_str}."
    }
    
    return responses.get(persona_style, responses["cheerful"])


def get_first_interaction_greeting(persona_style: str = "cheerful", timezone: str = "Asia/Kolkata") -> str:
    """
    Get a complete first-interaction greeting with time context.
    
    Args:
        persona_style: Style of the persona
        timezone: User's timezone
    
    Returns:
        A complete greeting for first interaction
    """
    datetime_info = get_current_datetime(timezone)
    time_of_day = get_time_of_day(datetime_info["hour"])
    greeting = get_greeting(time_of_day, persona_style)
    
    return greeting
