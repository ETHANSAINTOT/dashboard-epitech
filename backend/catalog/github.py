import httpx
from .errors import NotSubscribed
from .types import Param, Service, Widget

GRAPHQL_URL = "https://api.github.com/graphql"
# viewer = the account that connected: no username to type. the count travels as a GraphQL variable, never pasted in the query text
NUMBERS = tuple(str(number) for number in range(1, 11))
QUERY = """
query($number: Int!) {
  viewer {
    name
    login
    avatarUrl
    bio
    url
    repositories(first: $number, orderBy: {field: UPDATED_AT, direction: DESC}, privacy: PUBLIC, ownerAffiliations: OWNER) {
      nodes { name url stargazerCount primaryLanguage { name color } }
    }
  }
}
"""

async def fetch_repos(config, credentials):
    # each user's own OAuth token, from their subscription: never a shared or personal token of the project
    number = max(1, min(int(config["number"]), 10))
    headers = {"Authorization": f"Bearer {credentials['access_token']}"}
    async with httpx.AsyncClient(timeout=10, headers=headers) as client:
        response = await client.post(GRAPHQL_URL, json={"query": QUERY, "variables": {"number": number}})
    # revoked / deleted token -> front shows Connect again
    if response.status_code == 401:
        raise NotSubscribed("GitHub access expired, connect again")
    response.raise_for_status()
    user = (response.json().get("data") or {}).get("viewer")
    if user is None:
        raise NotSubscribed("GitHub access expired, connect again")
    return {
        "name": user["name"] or user["login"],
        "login": user["login"],
        "avatarUrl": user["avatarUrl"],
        "bio": user["bio"] or "",
        "url": user["url"],
        "repos": [
            {
                "name": repo["name"],
                "url": repo["url"],
                "stars": repo["stargazerCount"],
                "language": (repo["primaryLanguage"] or {}).get("name", ""),
                "languageColor": (repo["primaryLanguage"] or {}).get("color") or "#999999",
            }
            for repo in user["repositories"]["nodes"]
        ],
    }

SERVICE = Service(
    name="github",
    # each widget is connected to its own GitHub account (OAuth), like gmail
    requires_subscription=True,
    widgets=[
        Widget(
            name="repo_list",
            description="Profile and latest updated public repositories of the connected GitHub account",
            params=[Param("number", "integer", required=False, default=5, choices=NUMBERS)],
            fetch=fetch_repos,
        ),
    ],
)
