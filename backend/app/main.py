from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.core.graph_db import create_constraints, close_driver
from app.core.auth import create_user_constraint, seed_default_users
from app.api import ingest, reconcile, audit, risk, stats, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — don't crash if Neo4j isn't ready yet
    try:
        create_constraints()
        create_user_constraint()
        seed_default_users()
        print("Neo4j connected, constraints created.")
    except Exception as e:
        print(f"WARNING: Neo4j not available at startup: {e}")
        print("The app will start but DB operations will fail until Neo4j is reachable.")
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

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(ingest.router, prefix="/api/data", tags=["Data Ingestion"])
app.include_router(reconcile.router, prefix="/api/reconcile", tags=["Reconciliation"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit Trails"])
app.include_router(risk.router, prefix="/api/risk", tags=["Vendor Risk"])
app.include_router(stats.router, prefix="/api/stats", tags=["Dashboard Stats"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": settings.app_name}
