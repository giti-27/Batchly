from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from decimal import Decimal

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "BATCHLY"
    APP_ENV: str = "development"
    SECRET_KEY: str = "batchly-super-secret-production-grade-key-2026-invariants"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # Database
    DATABASE_URL: str = "sqlite:///./batchly.db"
    
    # Company Defaults (Tamil Nadu)
    COMPANY_NAME: str = "Batchly Foods Private Limited"
    COMPANY_GSTIN: str = "33AABCB1234F1Z5"
    COMPANY_STATE_CODE: str = "33"
    COMPANY_ADDRESS: str = "Plot 42, SIDCO Industrial Estate, Thuvakudi, Tiruchirappalli, Tamil Nadu 620015"
    COMPANY_FY_START_MONTH: int = 4
    COMPANY_INVOICE_PREFIX: str = "BTL"
    
    # Production & Invoicing Defaults
    VARIANCE_TOLERANCE_PCT: Decimal = Decimal("3.00")
    FG_SAFETY_PACKETS: int = 20
    INVOICE_ROUND_OFF: bool = False
    
    # Firebase Auth
    FIREBASE_PROJECT_ID: str = "limitless-c72be"
    FIREBASE_CLIENT_EMAIL: Optional[str] = None
    FIREBASE_PRIVATE_KEY: Optional[str] = None
    DEV_AUTH_BYPASS: bool = True
    
    # URLs & Networking
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    FRONTEND_URL: str = "http://localhost:5173"
    API_BASE_URL: str = "http://localhost:8000"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://localhost:8001"

settings = Settings()
