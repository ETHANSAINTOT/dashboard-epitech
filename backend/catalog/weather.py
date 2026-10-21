import httpx
from .places import find_place
from .types import Param, Service, Widget

# Open-Meteo: free, no key, no account. the city is found by places.find_place
# the current weather too is served on its /forecast endpoint
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
# forecast length the user can pick: beyond a week a forecast is barely better than a guess
DAYS = tuple(str(day) for day in range(1, 8))

# Open-Meteo gives a WMO weather code: code range -> (icon name on the front, label shown)
CONDITIONS = [
    ((0, 1), "clear", "Clear"),
    ((2, 3), "clouds", "Clouds"),
    ((45, 48), "mist", "Fog"),
    ((51, 57), "drizzle", "Drizzle"),
    ((61, 67), "rain", "Rain"),
    ((71, 77), "snow", "Snow"),
    ((80, 82), "rain", "Rain showers"),
    ((85, 86), "snow", "Snow showers"),
    # no storm icon in the old project: the rain one, but the label says it
    ((95, 99), "rain", "Thunderstorm"),
]

# what Open-Meteo is asked for each unit system, and the labels WE show (Open-Meteo writes "mp/h")
UNITS = {
    "metric": {"params": {}, "temperature": "°C", "wind": "km/h"},
    "imperial": {"params": {"temperature_unit": "fahrenheit", "wind_speed_unit": "mph"}, "temperature": "°F", "wind": "mph"},
}

def _condition(code):
    # the code can be missing in the answer
    if code is not None:
        for (low, high), icon, label in CONDITIONS:
            if low <= code <= high:
                return {"icon": icon, "label": label}
    return {"icon": "clouds", "label": "Unknown"}

# a widget created before the units param has none in its config
def _units(config):
    return UNITS[config.get("units", "metric")]

# one call to the weather endpoint for the found place, in the asked units. shared by both widgets
async def _weather(client, place, units, params):
    response = await client.get(WEATHER_URL, params={"latitude": place["latitude"], "longitude": place["longitude"], **params, **units["params"]})
    response.raise_for_status()
    return response.json()

async def fetch_city_temperature(config, credentials):
    units = _units(config)
    async with httpx.AsyncClient(timeout=10) as client:
        place = await find_place(client, config["city"])
        current = (await _weather(client, place, units, {"current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"}))["current"]
    return {
        "city": place["name"],
        "country": place["country"],
        "temperature": current["temperature_2m"],
        "humidity": current["relative_humidity_2m"],
        "wind": current["wind_speed_10m"],
        **_condition(current["weather_code"]),
        "units": {"temperature": units["temperature"], "wind": units["wind"]},
    }

async def fetch_city_forecast(config, credentials):
    units = _units(config)
    # validate_config already keeps it in DAYS, the clamp is for a row saved before that
    days = max(1, min(int(config.get("days", 5)), len(DAYS)))
    async with httpx.AsyncClient(timeout=10) as client:
        place = await find_place(client, config["city"])
        # timezone auto: the days are the city's own days, not UTC ones
        daily = (await _weather(client, place, units, {
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "timezone": "auto",
            "forecast_days": days,
        }))["daily"]
    return {
        "city": place["name"],
        "country": place["country"],
        # one list per value in the answer, same order: zip puts each day back together
        "days": [
            {"date": date, "min": low, "max": high, "rain": rain, **_condition(code)}
            for date, code, low, high, rain in zip(
                daily["time"], daily["weather_code"], daily["temperature_2m_min"], daily["temperature_2m_max"], daily["precipitation_probability_max"]
            )
        ],
        "units": {"temperature": units["temperature"]},
    }

SERVICE = Service(
    name="weather",
    requires_subscription=False,
    widgets=[
        Widget(
            name="city_temperature",
            description="Current weather for a city: temperature, sky, humidity, wind",
            params=[
                Param("city", "string", description="City name, e.g. Paris"),
                Param("units", "string", required=False, default="metric", choices=tuple(UNITS)),
            ],
            fetch=fetch_city_temperature,
        ),
        Widget(
            name="city_forecast",
            description="Forecast for the next days in a city: sky, min and max temperature, chance of rain",
            params=[
                Param("city", "string", description="City name, e.g. Paris"),
                Param("units", "string", required=False, default="metric", choices=tuple(UNITS)),
                Param("days", "integer", required=False, default=5, choices=DAYS),
            ],
            fetch=fetch_city_forecast,
        ),
    ],
)
