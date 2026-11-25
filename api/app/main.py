
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from api.app.config import settings
from api.app.db import engine, Base, SessionLocal
from api.app.services.ledger_service import init_db_triggers

# Import routers
from api.app.routers import (
    auth,
    masters,
    purchases,
    production,
    stock,
    orders,
    billing,
    dispatch,
    reports,
    intelligence,
    benchmark,
    payments,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables and initialize ledger triggers.
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        init_db_triggers(db)
    finally:
        db.close()

    yield


app = FastAPI(
    title="BATCHLY API",
    description="Intelligent Order-to-Audit Manufacturing Operations Platform API",
    version="1.0.0",
    lifespan=lifespan,
)


# Vercel forwards /api/... to this service without removing /api.
# Strip that prefix so the existing FastAPI routers continue to work.
@app.middleware("http")
async def normalize_api_prefix(request: Request, call_next):
    original_path = request.scope.get("path", "")
    new_path = original_path

    if original_path == "/api":
        new_path = "/"
    elif original_path.startswith("/api/"):
        new_path = original_path[4:]

    if new_path != original_path:
        request.scope["path"] = new_path
        request.scope["raw_path"] = new_path.encode("utf-8")

    return await call_next(request)


# CORS configuration
allowed_origins = [
    origin.strip()
    for origin in settings.CORS_ORIGINS.split(",")
    if origin.strip()
]

if settings.FRONTEND_URL and settings.FRONTEND_URL not in allowed_origins:
    allowed_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mount routers
app.include_router(auth.router)
app.include_router(masters.router)
app.include_router(purchases.router)
app.include_router(production.router)
app.include_router(stock.router)
app.include_router(orders.router)
app.include_router(billing.router)
app.include_router(dispatch.router)
app.include_router(reports.router)
app.include_router(intelligence.router)
app.include_router(benchmark.router)
app.include_router(payments.router)


@app.get("/")
def root():
    return {
        "name": "BATCHLY API",
        "tagline": "From Salesman's Order to Auditor's Report",
        "version": "1.0.0",
        "status": "ONLINE",
    }


@app.get("/health")
def health():
    return {"status": "HEALTHY"}
