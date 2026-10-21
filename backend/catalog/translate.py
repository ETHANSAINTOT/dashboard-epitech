import httpx
from config import LIBRETRANSLATE_URL
from .errors import WidgetError
from .types import Param, Service, Widget

# LibreTranslate code -> name shown in the selects, in this order. add one here AND in LT_LOAD_ONLY (docker-compose.yml)
LANGUAGES = {"en": "English", "fr": "French", "es": "Spanish", "zh-Hans": "Chinese", "ar": "Arabic",
             "pt": "Portuguese", "hi": "Hindi", "ja": "Japanese", "de": "German", "ru": "Russian", "id": "Indonesian"}
# our own limit (self-hosted has none): each pause re-translates the WHOLE text on the CPU
MAX_CHARS = 2000

async def translate_text(text, source, target):
    # nothing to translate, no need to wake the model
    if source == target:
        return text
    # CPU translation, and the 1st call after a start loads the model: more than the 10 s of an online api
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{LIBRETRANSLATE_URL}/translate",
                                     json={"q": text, "source": source, "target": target, "format": "text"})
    # errors = a real HTTP status + {"error": "..."}: read the message before giving up (the body may not be json)
    if response.status_code != 200:
        try:
            message = response.json().get("error")
        except ValueError:
            message = None
        raise WidgetError(message or "Translation failed")
    return response.json()["translatedText"]

# what GET /api/widgets/{id}/data answers for this widget: the language list
# so the list lives in ONE place (here) and the front builds its selects from it
# config / credentials unused, but every catalog widget has this same signature
async def fetch_languages(config, credentials):
    return {"languages": [{"code": code, "name": name} for code, name in LANGUAGES.items()]}

# the text itself is not a param: it is typed, not saved. it goes through POST /api/translate (part 2)
SERVICE = Service(
    name="translate",
    requires_subscription=False,
    widgets=[
        Widget(
            name="text",
            description="Translate a text between two languages",
            params=[
                Param("source", "string", required=False, default="en", choices=tuple(LANGUAGES)),
                Param("target", "string", required=False, default="fr", choices=tuple(LANGUAGES)),
            ],
            fetch=fetch_languages,
        ),
    ],
)

