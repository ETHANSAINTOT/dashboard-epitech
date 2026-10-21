import asyncio
import html
import ipaddress
import re
import socket
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit
import feedparser
import httpx
from .errors import WidgetError
from .types import Param, Service, Widget

TAG = re.compile(r"<[^>]+>")
SPACES = re.compile(r"\s+")
# a feed is a few dozen KB (franceinfo ~38 KB): 2 MB is plenty, and a huge file never fills the memory
MAX_FEED_BYTES = 2_000_000

# the server downloads a link typed by a user: never let it reach our internal services (db, libretranslate...)
async def _check_url(url):
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise WidgetError("Only http and https links are allowed")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(parts.hostname, None)
    except socket.gaierror:
        raise WidgetError(f"Unknown host: {parts.hostname}")
    # private, loopback, docker network (172.x)... anything not on the public internet
    # split("%"): an ipv6 can come with a zone ("fe80::1%eth0") that ip_address refuses
    if any(not ipaddress.ip_address(info[4][0].split("%")[0]).is_global for info in infos):
        raise WidgetError("This address is not allowed")

# httpx calls it before EVERY request: the first one and each redirect
async def _guard(request):
    await _check_url(str(request.url))

# html of a description -> plain readable text, cut cleanly on a word
# (react would not render the tags, it would show them as text)
def _plain(value, limit=300):
    text = SPACES.sub(" ", html.unescape(TAG.sub(" ", value or ""))).strip()
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + "…"

# feedparser gives a UTC date (or nothing) -> ISO 8601, the front shows it in local time
def _date(entry):
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    return datetime(*parsed[:6], tzinfo=timezone.utc).isoformat() if parsed else None

# a "javascript:" link in a feed would run code on click: only real web links are kept
def _safe_link(link):
    return link if link.startswith(("http://", "https://")) else ""

# downloads the feed: every address checked (redirects too), at most MAX_FEED_BYTES
async def _load_feed(url):
    # event_hooks: _guard runs before each request, so a public site redirecting to http://db:5432 is stopped too
    async with httpx.AsyncClient(timeout=10, follow_redirects=True, event_hooks={"request": [_guard]}) as client:
        # stream: the body comes in pieces, so a huge file is cut at the limit instead of being loaded whole
        async with client.stream("GET", url) as response:
            # a clear message for a dead link, rather than the generic "rss is unavailable"
            if response.status_code >= 400:
                raise WidgetError(f"The feed link answered HTTP {response.status_code}")
            body = bytearray()
            async for chunk in response.aiter_bytes():
                body += chunk
                if len(body) > MAX_FEED_BYTES:
                    raise WidgetError("Feed too large (2 MB max)")
    # bytes, not text: feedparser reads the encoding the XML itself declares
    feed = feedparser.parse(bytes(body))
    # feedparser never raises: a non-feed URL just comes back with no entries, so the check has to be explicit
    # not "bozo": it is also set for small faults (a badly written entity...) while the articles parse fine
    if not feed.entries:
        raise WidgetError(f"Not a valid RSS or Atom feed: {url}")
    return feed

# a feed is NOT sorted by date (franceinfo mixes them): no date = 1970, so at the end
def _newest_first(entry):
    return entry.get("published_parsed") or entry.get("updated_parsed") or time.gmtime(0)

async def fetch_article_list(config, credentials):
    feed = await _load_feed(config["link"])
    number = max(1, min(int(config["number"]), 20))
    latest = sorted(feed.entries, key=_newest_first, reverse=True)[:number]
    return {
        "feed": feed.feed.get("title", "Untitled feed"),
        "articles": [
            # every field is optional in both formats (RSS, Atom): always .get()
            {
                "title": _plain(entry.get("title")) or "Untitled",
                "description": _plain(entry.get("summary")),
                "link": _safe_link(entry.get("link", "")),
                "date": _date(entry),
            }
            for entry in latest
        ],
    }

SERVICE = Service(
    name="rss",
    requires_subscription=False,
    widgets=[
        Widget(
            name="article_list",
            description="Latest articles from an RSS or Atom feed",
            params=[Param("link", "string", description="Feed URL"), Param("number", "integer", required=False, default=5),],
            fetch=fetch_article_list,
        ),
    ],
)
