"""
Smart City Emergency Management System - AI Detection Service

FastAPI service providing real vehicle detection (YOLOv8 + ByteTrack) and plate OCR (EasyOCR).
Designed to be called by the ASP.NET Core backend.
"""

import io
import logging
import os
import time
from datetime import datetime, timezone

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import config as cfg
from detector import detect_from_image, remove_session, get_frame_stats_snapshot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("srms.ai")

app = FastAPI(
    title="SRMS AI Detection Service",
    description="YOLO vehicle detection + ByteTrack tracking + EasyOCR plate reading for Crime Vehicle Detection System",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "srms-ai-detection", "version": "2.0.0"}


@app.get("/config")
async def get_config():
    """Centralized detection/tracking/OCR/alert tunables (single source of truth)."""
    return cfg.as_dict()


@app.get("/stats")
async def get_stats():
    """Honest measured FPS + per-session frame counters (never faked)."""
    return get_frame_stats_snapshot()


@app.post("/detect")
async def detect_vehicle(
    image: UploadFile = File(...),
    session_id: str = Form(default=""),
):
    """
    Accept an image file and run vehicle detection + tracking + plate OCR pipeline.

    If session_id is provided, uses session-based ByteTrack tracking to avoid
    duplicate processing of the same vehicle across consecutive frames.
    """
    start = time.time()

    # Validate upload
    if image.content_type not in ("image/jpeg", "image/png", "image/webp", "image/bmp"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image format: {image.content_type}. Use JPEG, PNG, WebP, or BMP.",
        )

    image_bytes = await image.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image file")
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image exceeds 10MB limit")

    logger.info(f"[API] Received image: {image.filename} ({len(image_bytes)} bytes, session={session_id or 'none'})")

    # Run detection pipeline
    try:
        result = detect_from_image(image_bytes, session_id=session_id or None)
    except Exception as e:
        logger.exception(f"[API] Detection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Detection pipeline error: {str(e)}")

    elapsed = round(time.time() - start, 3)
    result["processingTimeMs"] = round(elapsed * 1000)
    if not result.get("frameStats"):
        result["frameStats"] = {
            "sessionId": session_id or None,
            "frameNumber": 0,
            "timestamp": datetime.now(timezone.utc).astimezone().isoformat(timespec="milliseconds"),
            "processingMs": round(elapsed * 1000, 1),
            "aiFps": 0.0,
            "targetAiFps": cfg.TARGET_AI_FPS,
            "frameIntervalMs": cfg.FRAME_INTERVAL_MS,
            "detectionCount": len(result.get("vehicles") or []),
            "trackCount": (result.get("trackingInfo") or {}).get("totalActiveTracks", 0),
            "confirmationFrames": cfg.CONFIRMATION_FRAMES,
        }
    logger.info(f"[API] Detection complete in {elapsed}s — status: {result['status']}")

    return JSONResponse(content=result)


@app.post("/session/end")
async def end_session(session_id: str = Form(...)):
    """End a tracking session and clean up its state."""
    remove_session(session_id)
    logger.info(f"[API] Session {session_id} ended and cleaned up")
    return {"status": "ok", "message": f"Session {session_id} ended"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_SERVICE_PORT", "8000"))
    logger.info(f"Starting SRMS AI Detection Service on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
