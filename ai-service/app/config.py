import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application settings
    APP_NAME: str = "Emergency Green Wave Signal Action AI Service"
    APP_ENV: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Google Gemini API configuration
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Backend Integration (Simulation ASP.NET Core API)
    BACKEND_BASE_URL: str = "http://localhost:5017/api"

    # Persistent Checkpoint Storage (SQLite)
    CHECKPOINT_DB_PATH: str = str(BASE_DIR / "checkpoints" / "signal_action_checkpoints.sqlite")


settings = Settings()

