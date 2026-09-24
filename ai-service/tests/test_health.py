"""Tests for FastAPI service health and root endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_root_endpoint():
    """Test that the root endpoint returns a 200 and running status."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        json_data = response.json()
        assert "is running" in json_data["message"]
        assert "environment" in json_data


@pytest.mark.asyncio
async def test_health_check_endpoint():
    """Test that the health endpoint returns a healthy status and schema fields."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        json_data = response.json()
        assert json_data["status"] == "healthy"
        assert json_data["version"] == "0.1.0"
        assert "service" in json_data
        assert "gemini_configured" in json_data
        assert isinstance(json_data["gemini_configured"], bool)
