import os
from dotenv import load_dotenv

load_dotenv()
load_dotenv("../.env")

# os.environ[...] rather than .get(): a missing variable must crash at startup with a clear name instead of silently pointing at the wrong database.
DATABASE_URL = (
    f"postgresql+asyncpg://{os.environ['POSTGRES_USER']}:{os.environ['POSTGRES_PASSWORD']}"
    f"@{os.environ['POSTGRES_HOST']}:{os.environ['POSTGRES_PORT']}/{os.environ['POSTGRES_DB']}"
)
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "60"))
EMAIL_VERIFICATION = os.environ["EMAIL_VERIFICATION"]
SMTP_HOST = os.environ["SMTP_HOST"]
SMTP_PORT = int(os.environ["SMTP_PORT"])
SMTP_USER = os.environ["SMTP_USER"]
SMTP_PASSWORD = os.environ["SMTP_PASSWORD"]
APP_BASE_URL = os.environ["APP_BASE_URL"]
CONFIRMATION_EXPIRES_HOURS = int(os.getenv("CONFIRMATION_EXPIRES_HOURS", "24"))
GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
GOOGLE_CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
GOOGLE_REDIRECT_URI = os.environ["GOOGLE_REDIRECT_URI"]
# self-hosted LibreTranslate (docker-compose service), no key needed. default = the compose service name
LIBRETRANSLATE_URL = os.getenv("LIBRETRANSLATE_URL", "http://libretranslate:5000")
# GitHub OAuth App of the dashboard (NOT a personal token): every user connects their own account. Optional: without them the Connect button answers "not configured"
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8080/api/oauth/github/callback")
