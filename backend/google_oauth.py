import time
from urllib.parse import urlencode
import httpx
from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile"
# read only, we never send or delete mails
SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

class GoogleAuthError(Exception):
    pass

def authorize_url(state):
    return AUTHORIZE_URL + "?" + urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "state": state,
        # offline + consent = google gives a refresh token, every time (not just the 1st)
        # select_account = always the account list, so another address can be picked
        "access_type": "offline",
        "prompt": "select_account consent",
    })

# previous=None bc the first exchange has no previous creds
def _to_credentials(payload, previous=None):
    return {
        "access_token": payload["access_token"],
        # refresh responses don't resend the refresh token -> keep the old one
        "refresh_token": payload.get("refresh_token") or (previous or {}).get("refresh_token"),
        # absolute time, expires_in is relative
        "expires_at": int(time.time()) + int(payload.get("expires_in", 3600)),
    }

async def exchange_code(code):
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(TOKEN_URL, data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
    if response.status_code != 200:
        raise GoogleAuthError(response.text)
    return _to_credentials(response.json())

# which google address the tokens belong to
# the gmail profile works with gmail.readonly, no extra scope (openid/email) needed
async def fetch_account_email(credentials):
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(PROFILE_URL, headers={"Authorization": f"Bearer {credentials['access_token']}"})
    if response.status_code != 200:
        raise GoogleAuthError(response.text)
    # lowercase: Alice@ and alice@ must not make 2 rows
    return response.json()["emailAddress"].lower()

async def ensure_fresh(credentials):
    # refresh 1 min early so it can't expire mid request
    if credentials.get("expires_at", 0) > time.time() + 60:
        return
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(TOKEN_URL, data={
            "refresh_token": credentials.get("refresh_token"),
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "grant_type": "refresh_token",
        })
    if response.status_code != 200:
        raise GoogleAuthError(response.text)
    # modified in place on purpose, runner.py sees the diff and saves it
    credentials.update(_to_credentials(response.json(), credentials))

async def revoke(credentials):
    token = credentials.get("refresh_token") or credentials.get("access_token")
    if not token:
        return
    # best effort, disconnect must work even if google is down
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(REVOKE_URL, data={"token": token})
    except httpx.HTTPError:
        pass
