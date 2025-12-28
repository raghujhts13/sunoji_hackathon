"""
Weather service module for fetching weather data from Open-Meteo API.
Includes location extraction via LLM and geocoding via geopy Nominatim.
"""
import httpx
from typing import Optional, Dict, Any, Tuple
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import logging

logger = logging.getLogger(__name__)

# Initialize geocoder with a user agent
geolocator = Nominatim(user_agent="sunoji-voice-companion")

# WMO Weather interpretation codes
WMO_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


def get_weather_emoji(weather_code: int) -> str:
    """Get an emoji representing the weather condition."""
    if weather_code == 0:
        return "☀️"
    elif weather_code in [1, 2]:
        return "🌤️"
    elif weather_code == 3:
        return "☁️"
    elif weather_code in [45, 48]:
        return "🌫️"
    elif weather_code in [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]:
        return "🌧️"
    elif weather_code in [71, 73, 75, 77, 85, 86]:
        return "❄️"
    elif weather_code in [95, 96, 99]:
        return "⛈️"
    return "🌡️"


def geocode_location(location_name: str) -> Optional[Tuple[float, float, str]]:
    """
    Convert a location name to latitude and longitude using Nominatim.
    
    Args:
        location_name: Name of the place (e.g., "Paris", "Tokyo, Japan")
    
    Returns:
        Tuple of (latitude, longitude, display_name) or None if not found
    """
    try:
        location = geolocator.geocode(location_name, timeout=10)
        if location:
            logger.info(f"Geocoded '{location_name}' to {location.latitude}, {location.longitude}")
            return (location.latitude, location.longitude, location.address)
        logger.warning(f"Could not geocode location: {location_name}")
        return None
    except GeocoderTimedOut:
        logger.error(f"Geocoding timed out for: {location_name}")
        return None
    except GeocoderServiceError as e:
        logger.error(f"Geocoding service error for {location_name}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected geocoding error for {location_name}: {e}")
        return None


async def get_weather(latitude: float, longitude: float) -> Dict[str, Any]:
    """
    Fetch current weather data from Open-Meteo API.
    
    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate
    
    Returns:
        Dictionary with weather data including temperature, humidity, conditions, etc.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature",
        "timezone": "auto"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            current = data.get("current", {})
            weather_code = current.get("weather_code", 0)
            
            return {
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "timezone": data.get("timezone"),
                "temperature": current.get("temperature_2m"),
                "temperature_unit": "°C",
                "apparent_temperature": current.get("apparent_temperature"),
                "humidity": current.get("relative_humidity_2m"),
                "wind_speed": current.get("wind_speed_10m"),
                "wind_speed_unit": "km/h",
                "weather_code": weather_code,
                "conditions": WMO_CODES.get(weather_code, "Unknown"),
                "emoji": get_weather_emoji(weather_code),
                "success": True
            }
    except httpx.TimeoutException:
        logger.error("Weather API request timed out")
        return {"success": False, "error": "Weather service timed out"}
    except httpx.HTTPStatusError as e:
        logger.error(f"Weather API HTTP error: {e}")
        return {"success": False, "error": f"Weather service error: {e.response.status_code}"}
    except Exception as e:
        logger.error(f"Unexpected weather API error: {e}")
        return {"success": False, "error": str(e)}


def format_weather_response(
    weather_data: Dict[str, Any],
    location_name: Optional[str] = None,
    persona_style: str = "cheerful"
) -> str:
    """
    Format weather data into a natural language response based on persona style.
    
    Args:
        weather_data: Weather data dictionary from get_weather()
        location_name: Name of the location (for display)
        persona_style: Style of response ("cheerful", "calm", "professional", "casual")
    
    Returns:
        Formatted weather response string
    """
    if not weather_data.get("success", False):
        error_responses = {
            "cheerful": "Oh no! I couldn't fetch the weather right now. Maybe try again in a bit? 🌈",
            "calm": "I apologize, but I'm unable to retrieve the weather information at the moment.",
            "professional": "Weather data is currently unavailable. Please try again later.",
            "casual": "Couldn't get the weather, sorry! Try again?"
        }
        return error_responses.get(persona_style, error_responses["cheerful"])
    
    temp = weather_data.get("temperature", "N/A")
    feels_like = weather_data.get("apparent_temperature", temp)
    conditions = weather_data.get("conditions", "Unknown")
    emoji = weather_data.get("emoji", "🌡️")
    humidity = weather_data.get("humidity", "N/A")
    wind = weather_data.get("wind_speed", "N/A")
    
    location_str = f"in {location_name}" if location_name else "at your location"
    
    responses = {
        "cheerful": f"{emoji} Great news! It's currently {temp}°C {location_str} with {conditions.lower()}! Feels like {feels_like}°C. Humidity is at {humidity}% and wind is blowing at {wind} km/h. Perfect weather to make the most of your day! ✨",
        "calm": f"The current weather {location_str} is {temp}°C with {conditions.lower()}. {emoji} It feels like {feels_like}°C. Humidity is {humidity}%, and wind speed is {wind} km/h.",
        "professional": f"Current conditions {location_str}: Temperature {temp}°C (feels like {feels_like}°C), {conditions}. Humidity: {humidity}%. Wind: {wind} km/h. {emoji}",
        "casual": f"It's {temp}°C {location_str}, {conditions.lower()}. {emoji} Feels like {feels_like}°C though. Wind's at {wind} km/h."
    }
    
    return responses.get(persona_style, responses["cheerful"])


def detect_persona_style(base_prompt: str) -> str:
    """
    Detect the persona style from the base prompt keywords.
    
    Args:
        base_prompt: The persona's base prompt text
    
    Returns:
        One of: "cheerful", "calm", "professional", "casual"
    """
    prompt_lower = base_prompt.lower()
    
    if any(word in prompt_lower for word in ["cheerful", "upbeat", "enthusiastic", "energetic", "exciting", "happy"]):
        return "cheerful"
    elif any(word in prompt_lower for word in ["calm", "soothing", "gentle", "peaceful", "relaxed", "tranquil"]):
        return "calm"
    elif any(word in prompt_lower for word in ["professional", "formal", "business", "corporate", "executive"]):
        return "professional"
    elif any(word in prompt_lower for word in ["casual", "friendly", "laid-back", "chill", "relaxed"]):
        return "casual"
    
    # Default to cheerful
    return "cheerful"
