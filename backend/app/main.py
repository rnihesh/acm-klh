from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.core.graph_db import create_constraints, close_driver
from app.api import ingest, reconcile, audit, risk, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    create_constraints()
    yield
    # Shutdown
    close_driver()


settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    description="Knowledge Graph-based GST reconciliation engine for ITC mismatch detection",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/api/data", tags=["Data Ingestion"])
app.include_router(reconcile.router, prefix="/api/reconcile", tags=["Reconciliation"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit Trails"])
app.include_router(risk.router, prefix="/api/risk", tags=["Vendor Risk"])
app.include_router(stats.router, prefix="/api/stats", tags=["Dashboard Stats"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": settings.app_name}
