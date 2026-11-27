
import os
from decimal import Decimal
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


INSECURE_SECRET_VALUES = {
    "batchly-super-secret-production-grade-key-2026-invariants",
    "local-development-only-secret",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    APP_NAME: str = "BATCHLY"
    APP_ENV: str = "development"

    # Local development default only.
    SECRET_KEY: str = "local-development-only-secret"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Database
    DATABASE_URL: str = "sqlite:///./batchly.db"

    # Company Defaults
    COMPANY_NAME: str = "Batchly Foods Private Limited"
    COMPANY_GSTIN: str = "33AABCB1234F1Z5"
    COMPANY_STATE_CODE: str = "33"

    COMPANY_ADDRESS: str = (
        "Plot 42, SIDCO Industrial Estate, Thuvakudi, "
        "Tiruchirappalli, Tamil Nadu 620015"
    )

    COMPANY_FY_START_MONTH: int = 4
    COMPANY_INVOICE_PREFIX: str = "BTL"

    # Production and Invoicing Defaults
    VARIANCE_TOLERANCE_PCT: Decimal = Decimal("3.00")
    FG_SAFETY_PACKETS: int = 20
    INVOICE_ROUND_OFF: bool = False

    # Firebase configuration retained for compatibility.
    # The current backend login flow uses bcrypt and JWT.
    FIREBASE_PROJECT_ID: str = "limitless-c72be"
    FIREBASE_CLIENT_EMAIL: Optional[str] = None
    FIREBASE_PRIVATE_KEY: Optional[str] = None

    DEV_AUTH_BYPASS: bool = False

    # Destructive reset is disabled unless explicitly enabled for a demo database.
    DEMO_RESET_ENABLED: bool = False

    # URLs and Networking
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    FRONTEND_URL: str = "http://localhost:5173"
    API_BASE_URL: str = "http://localhost:8000"

    CORS_ORIGINS: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:3000,"
        "http://127.0.0.1:3000,"
        "http://localhost:8000,"
        "http://localhost:8001"
    )


settings = Settings()


# Vercel serverless instances have an ephemeral filesystem. Never allow SQLite
# there: writes can disappear between invocations and concurrent instances.
if os.getenv("VERCEL") == "1" and settings.DATABASE_URL.lower().startswith("sqlite"):
    raise RuntimeError(
        "Vercel deployment requires a persistent PostgreSQL DATABASE_URL. "
        "Configure it in Vercel Project Settings > Environment Variables."
    )

# Prevent insecure defaults from being used in production.
if settings.APP_ENV.strip().lower() in {"production", "prod"}:

    if settings.SECRET_KEY in INSECURE_SECRET_VALUES:
        raise RuntimeError(
            "Production requires a unique SECRET_KEY. "
            "Set it in the deployment environment."
        )

    if settings.DATABASE_URL.lower().startswith("sqlite"):
        raise RuntimeError(
            "Production requires a persistent PostgreSQL database. "
            "SQLite is only supported for local development."
        )
