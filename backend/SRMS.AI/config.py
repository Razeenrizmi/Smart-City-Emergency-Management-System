"""
Centralized AI service tunables.

Every detection/tracking/OCR/alert knob lives here (env-overridable).
Frontend and ASP.NET backend read equivalent values via GET /config and
GET /api/detection/config so no thresholds are scattered across the stack.
"""

import os


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


# --- Frame sampling / AI FPS ---
# TARGET_AI_FPS = 5 → FRAME_INTERVAL_MS = 1000 / 5 = 200 ms between AI samples.
TARGET_AI_FPS = _env_int("TARGET_AI_FPS", 5)
FRAME_INTERVAL_MS = _env_int("FRAME_INTERVAL_MS", 1000 // max(TARGET_AI_FPS, 1))

# --- Detection thresholds ---
VEHICLE_CONFIDENCE_THRESHOLD = _env_float("VEHICLE_CONFIDENCE_THRESHOLD", 0.60)
IOU_THRESHOLD = _env_float("IOU_THRESHOLD", 0.45)  # reserved for tracker/NMS tuning
YOLO_IMGSZ = _env_int("YOLO_IMGSZ", 640)

# --- Tracking ---
TRACK_TIMEOUT_SECONDS = _env_float("TRACK_TIMEOUT_SECONDS", 3.0)
# A track must be seen this many frames before it is reported (multi-frame confirmation).
CONFIRMATION_FRAMES = max(1, _env_int("CONFIRMATION_FRAMES", 3))

# --- OCR / plate voting ---
OCR_CONFIDENCE_THRESHOLD = _env_float("OCR_CONFIDENCE_THRESHOLD", 0.30)
# Free-text (non format-matched) plates need higher confidence to be accepted.
OCR_FALLBACK_MIN_CONF = _env_float("OCR_FALLBACK_MIN_CONF", 0.55)
# Max OCR attempts per track (1 at confirmation crossing + limited retries).
OCR_MAX_ATTEMPTS = max(1, _env_int("OCR_MAX_ATTEMPTS", 3))
# Minimum votes before the plate is accepted as final (mode of accumulated votes).
# 2 = at least two OCR passes so A↔4 style variants can merge before finalize.
PLATE_VOTE_MIN = max(1, _env_int("PLATE_VOTE_MIN", 2))

# --- Alert cooldown (seconds) ---
# Same plate re-sighted on the same node within this window suppresses a re-alert.
ALERT_COOLDOWN = _env_float("ALERT_COOLDOWN", 60.0)

# --- Measured FPS window ---
FPS_WINDOW_SIZE = max(1, _env_int("FPS_WINDOW_SIZE", 30))


def as_dict() -> dict:
    """Config payload shared by the AI service, ASP.NET backend and frontend."""
    return {
        "targetAiFps": TARGET_AI_FPS,
        "frameIntervalMs": FRAME_INTERVAL_MS,
        "confidenceThreshold": VEHICLE_CONFIDENCE_THRESHOLD,
        "iouThreshold": IOU_THRESHOLD,
        "yoloImgsz": YOLO_IMGSZ,
        "trackingTimeoutSeconds": TRACK_TIMEOUT_SECONDS,
        "confirmationFrames": CONFIRMATION_FRAMES,
        "ocrConfidenceThreshold": OCR_CONFIDENCE_THRESHOLD,
        "ocrFallbackMinConf": OCR_FALLBACK_MIN_CONF,
        "ocrMaxAttempts": OCR_MAX_ATTEMPTS,
        "plateVoteMin": PLATE_VOTE_MIN,
        "alertCooldownSeconds": ALERT_COOLDOWN,
        "fpsWindowSize": FPS_WINDOW_SIZE,
    }
