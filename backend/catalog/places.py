from .errors import WidgetError

# Open-Meteo geocoding: free, no key, no account. shared by the weather and clock services
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"

# what the user typed -> the place Open-Meteo found: real name ("lille" -> "Lille"), position and time zone
async def find_place(client, city):
    response = await client.get(GEOCODING_URL, params={"name": city, "count": 1, "language": "en"})
    response.raise_for_status()
    results = response.json().get("results")
    # unknown city: the answer has no "results" key at all
    if not results:
        raise WidgetError(f"Unknown city: {city}")
    place = results[0]
    return {
        "latitude": place["latitude"],
        "longitude": place["longitude"],
        "name": place["name"],
        "country": place.get("country", ""),
        "timezone": place.get("timezone", ""),
    }
