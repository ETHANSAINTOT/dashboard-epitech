import asyncio
import httpx
from .errors import WidgetError
from .types import Param, Service, Widget

API = "https://www.cheapshark.com/api/1.0"
REDIRECT = "https://www.cheapshark.com/redirect?dealID="
USER_AGENT = "EpitechDashboard/1.0 (school project)"

async def _get(client, path, params=None):
    try:
        response = await client.get(f"{API}/{path}", params=params)
    except httpx.HTTPError:
        raise WidgetError("CheapShark is unreachable")
    if response.status_code >= 400:
        raise WidgetError(f"CheapShark answered HTTP {response.status_code}")
    try:
        return response.json()
    except ValueError:
        raise WidgetError("CheapShark sent an invalid answer")

# upperPrice=0: only the deals at 0 -> the free games of the moment
async def fetch_free_games(config, credentials):
    number = max(1, min(int(config["number"]), 20))
    # CheapShark answers HTTP 400 to a request without a descriptive User-Agent
    async with httpx.AsyncClient(timeout=10, headers={"User-Agent": USER_AGENT}) as client:
        # the store names (Steam, Epic...) come from a second endpoint: both calls run at the same time
        deals, stores = await asyncio.gather(
            _get(client, "deals", {"upperPrice": 0, "pageSize": number, "sortBy": "recent"}),
            _get(client, "stores"),
        )
    names = {store["storeID"]: store["storeName"] for store in stores}
    return {
        "games": [
            {
                "title": deal.get("title", "Untitled"),
                "thumb": deal.get("thumb", ""),
                "store": names.get(deal.get("storeID"), "Unknown store"),
                # the price the game normally costs, before it became free
                "normalPrice": deal.get("normalPrice", "0"),
                # the link goes through CheapShark, which redirects to the store page: no store url to build
                "link": REDIRECT + deal["dealID"],
            }
            for deal in deals
            if "dealID" in deal
        ]
    }

SERVICE = Service(
    name="cheapshark",
    requires_subscription=False,
    widgets=[
        Widget(
            name="free_games",
            description="Games that are free right now",
            params=[Param("number", "integer", required=False, default=5)],
            fetch=fetch_free_games,
        ),
    ],
)
