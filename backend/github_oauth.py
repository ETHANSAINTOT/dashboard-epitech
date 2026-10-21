import logging
import httpx
from config import GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI
from urllib.parse import urlencode

AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
TOKEN_URL = "https://github.com/login/oauth/access_token"
USER_URL = "https://api.github.com/user"
TOKEN_API_URL = f"https://api.github.com/applications/{GITHUB_CLIENT_ID}/token"

log = logging.getLogger("uvicorn.error")

class GithubAuthError(Exception):
    pass

def is_configured():
    return bool(GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET)

def authorize_url(state):
    # no scope = public data only (profile + public repos): the least we can ask
    # allow_signup off: this is a login, not a signup
    return AUTHORIZE_URL + "?" + urlencode({
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "state": state,
        "allow_signup": "false",
    })

async def exchange_code(code):
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(TOKEN_URL, headers={"Accept": "application/json"}, data={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": GITHUB_REDIRECT_URI,
        })
    payload = response.json() if response.status_code == 200 else {}
    # github answers 200 even for a bad code: the error is in the body
    if "access_token" not in payload:
        # only GitHub's error code (bad_verification_code, incorrect_client_credentials...), never a secret
        log.warning("github token exchange failed: http %s %s", response.status_code, payload.get("error"))
        raise GithubAuthError("GitHub refused the code")
    return {"access_token": payload["access_token"]}

# which github account the token belongs to
async def fetch_login(credentials):
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(USER_URL, headers={"Authorization": f"Bearer {credentials['access_token']}"})
    if response.status_code != 200:
        log.warning("github profile read failed: http %s", response.status_code)
        raise GithubAuthError("GitHub refused the token")
    # lowercase: Alice and alice must not make 2 rows
    return response.json()["login"].lower()

async def revoke(credentials):
    token = credentials.get("access_token")
    if not token or not is_configured():
        return
    # best effort, disconnect must work even if github is down. deletes THIS token only
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.request("DELETE", TOKEN_API_URL, auth=(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET), json={"access_token": token}, headers={"Accept": "application/vnd.github+json"})
    except httpx.HTTPError:
        pass
