"""Main entry point for the Emergency Green Wave Signal Action AI Service."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents import agent_router
from app.config import settings
from app.models.schemas import HealthCheckResponse

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Signal Action Agent AI service for the Smart City Emergency Management System. "
        "Provides route/junction analysis and structured signal action proposals "
        "for the Emergency Green Wave simulation."
    ),
    version="0.1.0",
)

# Enable CORS for local simulation frontend and integration testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount agent routes
app.include_router(agent_router, prefix="/api/v1")
app.include_router(agent_router)


@app.get("/", tags=["General"])
async def root():
    """Root status endpoint."""
    return {
        "message": f"{settings.APP_NAME} is running",
        "environment": settings.APP_ENV,
        "docs_url": "/docs",
        "agent_endpoint": "/api/v1/agent/propose-signals",
    }


@app.get("/health", response_model=HealthCheckResponse, tags=["Health"])
async def health_check():
    """Health check endpoint providing service health and configuration status."""
    return HealthCheckResponse(
        status="healthy",
        service=settings.APP_NAME,
        version="0.1.0",
        gemini_configured=bool(settings.GEMINI_API_KEY),
    )
