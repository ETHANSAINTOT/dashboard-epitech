from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from sqlalchemy import text
from database import Base, engine
from routes import about, auth, users, widgets, oauth, github_connect, translate

# Runs once at startup and creates the missing tables. It does NOT alter tables that already exist, so changing a column means recreating the database volume
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        # Columns added after the table existed: added by hand so an existing volume (the teammate's) keeps working, until we use Alembic
        # one statement per execute: asyncpg refuses several in a single call
        await connection.execute(text("ALTER TABLE widget_instances ADD COLUMN IF NOT EXISTS x INTEGER"))
        await connection.execute(text("ALTER TABLE widget_instances ADD COLUMN IF NOT EXISTS y INTEGER"))
        await connection.execute(text("ALTER TABLE widget_instances ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL"))
        await connection.execute(text("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS account VARCHAR(255)"))
        # the old one-gmail-per-user rule: a 2nd address would crash on it
        await connection.execute(text("ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS uq_subscription_user_service"))
        # an index, not ADD CONSTRAINT: postgres has no IF NOT EXISTS there. same name as in models.py -> no-op on a fresh db
        await connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_user_service_account ON subscriptions (user_id, service_name, account)"))
        # int -> float for refreshes like 12.5 s. old 300 becomes 300.0, a no-op once the column is already a double
        await connection.execute(text("ALTER TABLE widget_instances ALTER COLUMN refresh_seconds TYPE DOUBLE PRECISION"))
        # card zoom (resize corner): 1 = normal size, every existing card starts there
        await connection.execute(text("ALTER TABLE widget_instances ADD COLUMN IF NOT EXISTS scale DOUBLE PRECISION NOT NULL DEFAULT 1"))
        # date the Terms of Service were accepted. null for the accounts made before the signup box
        await connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ"))
    yield
    await engine.dispose()

app = FastAPI(title="Dashboard API", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(about.router)
app.include_router(widgets.router)
app.include_router(oauth.router)
app.include_router(github_connect.router)
app.include_router(translate.router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)
