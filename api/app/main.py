import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.app.config import settings
from api.app.db import engine, Base, SessionLocal
from api.app.services.ledger_service import init_db_triggers

# Import routers
from api.app.routers import (
    auth, masters, purchases, production, stock,
    orders, billing, dispatch, reports, intelligence, benchmark
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables & DB triggers are created
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
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

@app.get("/")
def root():
    return {
        "name": "BATCHLY API",
        "tagline": "From Salesman's Order to Auditor's Report",
        "version": "1.0.0",
        "status": "ONLINE"
    }

@app.get("/health")
def health():
    return {"status": "HEALTHY"}
