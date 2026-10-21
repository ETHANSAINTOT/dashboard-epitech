import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from catalog.errors import WidgetError
from catalog.translate import translate_text
from schemas import TranslateRequest
from security import current_user

router = APIRouter(prefix="/api", tags=["translate"])

# the typed text is not a widget setting: it is not saved, it only goes through here
# languages come with the text, so no need to wait for the widget's PATCH before translating
# logged in only (user unused but required): our translation server must not become a free public proxy
@router.post("/translate")
async def translate(payload: TranslateRequest, user=Depends(current_user)):
    try:
        text = await translate_text(payload.text, payload.source, payload.target)
    # LibreTranslate said no (unknown language, model not loaded...): its own message is readable, pass it on
    except WidgetError as error:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(error))
    # not reachable (still downloading its models, stopped...): a short message, not the technical one
    # the usual cause is a 1st start (or a volume prune): say it, so nobody thinks it is broken
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Translation server not ready yet (its first start downloads the language models, about 10 min)")
    return {"translatedText": text}
