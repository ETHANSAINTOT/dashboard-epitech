from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import httpx
from .errors import WidgetError
from .places import find_place
from .types import Param, Service, Widget

# Open-Meteo finds the city AND gives its time zone ("Lille" -> "Europe/Paris").
# the time itself comes from the server clock + python's time zone database: no time API that can go down
async def fetch_current_time(config, credentials):
    async with httpx.AsyncClient(timeout=10) as client:
        place = await find_place(client, config["city"])
    try:
        now = datetime.now(ZoneInfo(place["timezone"]))
    # a place without a time zone ("" -> ValueError), or one this server's database does not know
    except (ValueError, ZoneInfoNotFoundError):
        raise WidgetError(f"No time zone known for {place['name']}")
    # "+0200" -> "+02:00"
    offset = now.strftime("%z")
    return {
        "city": place["name"],
        "country": place["country"],
        "timezone": place["timezone"],
        "offset": f"{offset[:3]}:{offset[3:]}",
        # CEST, JST... some zones only have a number ("+04" for Dubai)
        "abbreviation": now.tzname(),
        "dst": bool(now.dst()),
        # the server clock in ms: the card corrects the browser's own clock with it
        "now": int(now.timestamp() * 1000),
    }

SERVICE = Service(
    name="clock",
    requires_subscription=False,
    widgets=[
        Widget(
            name="current_time",
            description="Current time in a city, with its time zone and UTC offset",
            params=[Param("city", "string", description="City name, e.g. Tokyo")],
            fetch=fetch_current_time,
        ),
    ],
)
