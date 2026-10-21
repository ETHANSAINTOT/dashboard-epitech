import asyncio
import html
from datetime import datetime, timezone
from email.utils import parseaddr
import httpx
import google_oauth
from .errors import NotSubscribed
from .types import Param, Service, Widget

MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
# emails the user can show: each one costs a Gmail call per refresh, and 10 rows already fill a card
NUMBERS = tuple(str(number) for number in range(1, 11))

def _header(message, name):
    for header in message.get("payload", {}).get("headers", []):
        if header["name"].lower() == name.lower():
            return header["value"]
    return ""

def _summarise(message):
    display_name, address = parseaddr(_header(message, "From"))
    return {
        "id": message["id"],
        # "Google <no-reply@accounts.google.com>" -> "Google"
        "from": display_name or address,
        "subject": _header(message, "Subject") or "(no subject)",
        # gmail html-escapes snippets (&#39; etc)
        "snippet": html.unescape(message.get("snippet", "")),
        # internalDate = epoch in ms, easier than parsing the Date header
        "date": datetime.fromtimestamp(int(message["internalDate"]) / 1000, timezone.utc).isoformat(),
        "unread": "UNREAD" in message.get("labelIds", []),
        # the conversation id, for a link that opens the mail in web Gmail
        "threadId": message.get("threadId", message["id"]),
    }

async def fetch_inbox(config, credentials):
    try:
        await google_oauth.ensure_fresh(credentials)
    except google_oauth.GoogleAuthError:
        # expired / revoked = not connected anymore -> front shows Connect again
        raise NotSubscribed("Gmail access expired, connect again")
    # validate_config already keeps it in NUMBERS, the clamp is for a row saved before that
    number = max(1, min(int(config["number"]), len(NUMBERS)))
    headers = {"Authorization": f"Bearer {credentials['access_token']}"}
    async with httpx.AsyncClient(timeout=10, headers=headers) as client:
        listing = await client.get(MESSAGES_URL, params={"maxResults": number, "labelIds": "INBOX"})
        listing.raise_for_status()
        ids = [item["id"] for item in listing.json().get("messages", [])]
        # the list only gives ids -> 1 call per mail, all in parallel
        # list of tuples bc a dict can't have metadataHeaders twice
        responses = await asyncio.gather(*(
            client.get(f"{MESSAGES_URL}/{message_id}", params=[
                ("format", "metadata"),
                ("metadataHeaders", "From"),
                ("metadataHeaders", "Subject"),
            ])
            for message_id in ids
        ))
    for response in responses:
        response.raise_for_status()
    return {"emails": [_summarise(response.json()) for response in responses]}

SERVICE = Service(
    name="gmail",
    requires_subscription=True,
    widgets=[
        Widget(
            name="inbox",
            description="Latest emails from your Gmail inbox",
            # subject says a widget needs at least 1 param
            params=[Param("number", "integer", required=False, default=5, choices=NUMBERS)],
            fetch=fetch_inbox,
        ),
    ],
)
