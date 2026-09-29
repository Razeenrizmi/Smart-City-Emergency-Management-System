"""
Crime Vehicle Detection - YOLO Vehicle Detection + ByteTrack Tracking + EasyOCR Plate Reading

Pipeline:
  Image → YOLOv8 (vehicle detection + ByteTrack) → multi-frame confirmation
        → OCR plate voting → structured result + honest frame stats

Tracking Rules:
  - Each vehicle gets a persistent track_id across frames
  - A track must be seen CONFIRMATION_FRAMES times before it is reported
  - OCR runs at confirmation crossing + limited retries (OCR_MAX_ATTEMPTS)
  - Final plate = mode of accumulated votes (PLATE_VOTE_MIN)
  - Track timeout: vehicles not seen for TRACK_TIMEOUT_SECONDS are marked inactive
  - Person class is NEVER classified as a vehicle
  - All tunables live in config.py (no scattered thresholds)
"""

import io
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Set, Tuple, List
from collections import defaultdict, deque

import cv2
import easyocr
import numpy as np
from PIL import Image
from ultralytics import YOLO

import config as cfg

logger = logging.getLogger("srms.ai")

# Vehicle class IDs in YOLOv8 COCO model
# 2=car, 3=motorcycle, 5=bus, 7=truck
VEHICLE_CLASS_IDS = {2, 3, 5, 7}
PERSON_CLASS_ID = 0

CLASS_NAMES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

# Sri Lankan plate format patterns
PLATE_PATTERNS = [
    re.compile(r'^[A-Z]{2}\s?[A-Z]{1,3}[\s\-]?\d{3,4}$'),
    re.compile(r'^[A-Z]{2,3}[\s\-]?\d{3,4}$'),
    re.compile(r'^[A-Z]{2}\s\d{3,4}$'),
    re.compile(r'^[A-Z]{1,3}[\s\-]?\d{1,4}[\s\-]?[A-Z]{0,3}$'),
]

GARBAGE_PATTERNS = [
    "AI", "PNOLOS", "ALL", "PHOTOS", "PLATE", "VEHICLE", "CAR",
    "TRUCK", "BUS", "BIKE", "MOTOR", "SCHOOL", "HOSPITAL", "STOP",
    "POLICE", "TAXI", "AUTO", "TRANSIT", "LIMIT",
    "SPEED", "ZONE", "ROAD", "STREET", "AVENUE", "DRIVE",
]

# Thresholds come from centralized config (env-overridable).
VEHICLE_CONFIDENCE_THRESHOLD = cfg.VEHICLE_CONFIDENCE_THRESHOLD
OCR_CONFIDENCE_THRESHOLD = cfg.OCR_CONFIDENCE_THRESHOLD
OCR_FALLBACK_MIN_CONF = getattr(cfg, "OCR_FALLBACK_MIN_CONF", 0.55)
TRACK_TIMEOUT_SECONDS = cfg.TRACK_TIMEOUT_SECONDS
CONFIRMATION_FRAMES = cfg.CONFIRMATION_FRAMES
OCR_MAX_ATTEMPTS = cfg.OCR_MAX_ATTEMPTS
PLATE_VOTE_MIN = cfg.PLATE_VOTE_MIN
FPS_WINDOW_SIZE = cfg.FPS_WINDOW_SIZE

# Singleton state
_yolo_model: Optional[YOLO] = None
_ocr_reader: Optional[easyocr.Reader] = None

# Per-session YOLO models: each session keeps its own ByteTrack state so
# tracking from different CCTV nodes/sessions NEVER mixes.
_session_models: Dict[str, YOLO] = {}

# Honest measured AI FPS: sliding window of real completion timestamps.
_completion_times: deque = deque(maxlen=FPS_WINDOW_SIZE)
_session_completion: Dict[str, deque] = {}

# Per-session frame counters (frame number in the log is real, not guessed).
_session_frame_numbers: Dict[str, int] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="milliseconds")


def _measure_ai_fps(window: deque) -> float:
    """Actual AI FPS from real completion timestamps — never faked."""
    if len(window) < 2:
        return 0.0
    span = window[-1] - window[0]
    if span <= 0:
        return 0.0
    return round((len(window) - 1) / span, 2)


def _record_completion(session_id: Optional[str]) -> None:
    now = time.time()
    _completion_times.append(now)
    if session_id:
        if session_id not in _session_completion:
            _session_completion[session_id] = deque(maxlen=FPS_WINDOW_SIZE)
        _session_completion[session_id].append(now)


def get_frame_stats_snapshot() -> dict:
    """Global + per-session measured stats for GET /stats."""
    sessions = {}
    for sid, window in _session_completion.items():
        sessions[sid] = {
            "frameNumber": _session_frame_numbers.get(sid, 0),
            "measuredAiFps": _measure_ai_fps(window),
            "samples": len(window),
        }
    return {
        "targetAiFps": cfg.TARGET_AI_FPS,
        "frameIntervalMs": cfg.FRAME_INTERVAL_MS,
        "confirmationFrames": CONFIRMATION_FRAMES,
        "alertCooldownSeconds": cfg.ALERT_COOLDOWN,
        "measuredAiFps": _measure_ai_fps(_completion_times),
        "samples": len(_completion_times),
        "activeSessions": sessions,
    }


class TrackState:
    """Represents the state of a tracked vehicle."""
    def __init__(self, track_id: int, class_name: str, confidence: float, bbox: list, timestamp: float):
        self.track_id = track_id
        self.class_name = class_name
        self.confidence = confidence
        self.bbox = bbox
        self.first_seen = timestamp
        self.last_seen = timestamp
        self.active = True
        self.processed = False
        self.plate_number: Optional[str] = None
        self.ocr_confidence: float = 0.0
        # Multi-frame confirmation
        self.hits = 0
        self.confirmed = False
        # OCR voting
        self.ocr_attempts = 0
        self.plate_votes: Dict[str, int] = defaultdict(int)
        self.plate_conf_votes: Dict[str, List[float]] = defaultdict(list)

    @property
    def pending_confirmation(self) -> bool:
        return self.active and not self.confirmed

    @property
    def awaiting_ocr(self) -> bool:
        return (
            self.active
            and self.confirmed
            and not self.processed
            and self.ocr_attempts < OCR_MAX_ATTEMPTS
        )


class SessionTracker:
    """Manages vehicle tracking for a CCTV session."""
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.active_tracks: Dict[int, TrackState] = {}
        self.processed_track_ids: Set[int] = set()
        self.processed_plates: Set[str] = set()
        self.created_at = time.time()

    def update_tracks(self, detections: list, current_time: float) -> Tuple[List[TrackState], List[TrackState]]:
        """
        Update tracked vehicles with new detections.
        Returns (processable_tracks, pending_confirmation_tracks):
          - processable: confirmed this frame, not yet processed (OCR eligible)
          - pending: active but still accumulating confirmation hits
        """
        current_track_ids = set()

        for det in detections:
            track_id = det["trackId"]
            if track_id is None:
                continue
            current_track_ids.add(track_id)

            if track_id in self.active_tracks:
                track = self.active_tracks[track_id]
                track.confidence = det["confidence"]
                track.bbox = det["boundingBox"]
                track.last_seen = current_time
                track.active = True
                track.hits += 1
            else:
                track = TrackState(
                    track_id=track_id,
                    class_name=det["class"],
                    confidence=det["confidence"],
                    bbox=det["boundingBox"],
                    timestamp=current_time,
                )
                track.hits = 1
                self.active_tracks[track_id] = track

            if not track.confirmed and track.hits >= CONFIRMATION_FRAMES:
                track.confirmed = True
                logger.info(
                    f"[AI] Track {track.track_id} CONFIRMED after {track.hits} frames "
                    f"(threshold={CONFIRMATION_FRAMES})"
                )

        # Mark tracks as inactive if not seen recently
        for track_id, track in list(self.active_tracks.items()):
            if track_id not in current_track_ids:
                elapsed = current_time - track.last_seen
                if elapsed > TRACK_TIMEOUT_SECONDS:
                    track.active = False

        processable = [
            t for t in self.active_tracks.values()
            if t.confirmed and not t.processed and t.track_id in current_track_ids
        ]
        pending = [
            t for t in self.active_tracks.values()
            if t.pending_confirmation and t.track_id in current_track_ids
        ]
        return processable, pending

    def mark_processed(self, track_id: int, plate_number: Optional[str] = None):
        """Mark a track as processed."""
        if track_id in self.active_tracks:
            self.active_tracks[track_id].processed = True
            self.processed_track_ids.add(track_id)
            if plate_number:
                self.active_tracks[track_id].plate_number = plate_number
                self.processed_plates.add(plate_number.replace(" ", "").upper())

    def is_duplicate_plate(self, plate: str) -> bool:
        """Check if plate was already processed in this session."""
        cleaned = plate.replace(" ", "").upper()
        return cleaned in self.processed_plates

    def cleanup(self):
        """Remove inactive tracks older than 2x timeout."""
        now = time.time()
        to_remove = []
        for track_id, track in self.active_tracks.items():
            if not track.active and (now - track.last_seen) > TRACK_TIMEOUT_SECONDS * 2:
                to_remove.append(track_id)
        for track_id in to_remove:
            del self.active_tracks[track_id]


# Global session storage
_sessions: Dict[str, SessionTracker] = {}


def get_session(session_id: str) -> SessionTracker:
    """Get or create a session tracker."""
    if session_id not in _sessions:
        _sessions[session_id] = SessionTracker(session_id)
    return _sessions[session_id]


def remove_session(session_id: str):
    """Remove a session and its isolated YOLO/ByteTrack model."""
    _sessions.pop(session_id, None)
    _session_models.pop(session_id, None)
    _session_completion.pop(session_id, None)
    _session_frame_numbers.pop(session_id, None)


def _get_yolo() -> YOLO:
    global _yolo_model
    if _yolo_model is None:
        logger.info("[AI] Loading YOLOv8n model...")
        _yolo_model = YOLO("yolov8n.pt")
        logger.info("[AI] YOLOv8n model loaded successfully")
    return _yolo_model


def _get_yolo_for_session(session_id: str) -> YOLO:
    """Return a session-isolated YOLO model (its ByteTrack state never crosses sessions)."""
    if session_id not in _session_models:
        logger.info(f"[AI] Loading isolated YOLOv8n model for session {session_id}...")
        _session_models[session_id] = YOLO("yolov8n.pt")
        logger.info(f"[AI] Isolated model ready for session {session_id}")
    return _session_models[session_id]


def _get_ocr() -> easyocr.Reader:
    global _ocr_reader
    if _ocr_reader is None:
        logger.info("[AI] Loading EasyOCR reader (en)...")
        _ocr_reader = easyocr.Reader(["en"], gpu=False)
        logger.info("[AI] EasyOCR reader loaded successfully")
    return _ocr_reader


# Optical-character confusions merged when clustering votes (e.g. A↔4, O↔0, I↔1, S↔5, B↔8, Z↔2, G↔6, D↔0).
_OCR_CONFUSIONS = {
    "0": "O", "1": "I", "4": "A", "5": "S", "8": "B",
    "2": "Z", "6": "G", "O": "O", "I": "I", "A": "A",
}


def _validate_plate_format(plate_text: str) -> bool:
    cleaned = plate_text.strip().upper()
    if len(cleaned) < 4 or len(cleaned) > 12:
        return False
    if cleaned in GARBAGE_PATTERNS:
        return False
    # Reject only whole-token garbage words, not substrings (substring check
    # wrongly killed valid plates containing "AI", "ALL", etc.).
    tokens = re.split(r"[\s\-]+", cleaned)
    if any(t in GARBAGE_PATTERNS for t in tokens if len(t) >= 3):
        return False
    if not any(c.isdigit() for c in cleaned):
        return False
    # Structural check on the normalized key: 2–4 letters, then 3–4 digits,
    # optional trailing letters. Blocks body-text misreads like EECHF 717
    # (5-letter run) that loose display patterns still matched.
    key = _normalize_plate_key(cleaned)
    if re.match(r"^[A-Z]{5,}\d", key):
        return False
    if not re.match(r"^[A-Z]{2,4}\d{3,4}[A-Z]{0,3}$", key):
        return False
    return any(p.match(cleaned) for p in PLATE_PATTERNS)


def _normalize_plate_key(plate: str) -> str:
    """Vote/compare key: uppercase, strip spaces/hyphens."""
    return re.sub(r"[\s\-]+", "", plate.strip().upper())


def _format_plate(key: str) -> str:
    """Pretty Sri Lankan-style display: CCA2101 → CCA 2101."""
    m = re.match(r"^([A-Z]{1,4})(\d{3,4})$", key)
    if m:
        return f"{m.group(1)} {m.group(2)}"
    m = re.match(r"^([A-Z]{1,3})(\d{1,4})([A-Z]{1,3})$", key)
    if m:
        return f"{m.group(1)} {m.group(2)} {m.group(3)}"
    return key


def _plate_similarity(a: str, b: str) -> int:
    """Levenshtein distance on short plate keys."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _merge_ocr_variants(text: str) -> str:
    """Apply common OCR digit/letter confusions so A↔4 style variants normalize together."""
    out = []
    for ch in text.upper():
        out.append(_OCR_CONFUSIONS.get(ch, ch))
    return "".join(out)


def _score_plate_candidate(text: str, conf: float) -> Tuple[int, float]:
    """
    Higher is better.
    2 = strict format match, 1 = plate-like free text, 0 = reject.
    """
    cleaned = text.strip().upper().replace("  ", " ")
    if len(cleaned) < 4 or len(cleaned) > 12:
        return 0, 0.0
    if not any(c.isdigit() for c in cleaned):
        return 0, 0.0
    tokens = re.split(r"[\s\-]+", cleaned)
    if any(t in GARBAGE_PATTERNS for t in tokens if len(t) >= 3):
        return 0, 0.0
    if _validate_plate_format(cleaned):
        # Format-valid plates accepted even at modest OCR confidence.
        return 2, conf
    if conf >= OCR_FALLBACK_MIN_CONF and re.search(r"[A-Z].*\d|\d.*[A-Z]", cleaned):
        # Free text with letters+digits and decent confidence only.
        return 1, conf
    return 0, 0.0


def _preprocess_plate_region(region_bgr) -> Optional[np.ndarray]:
    """Grayscale + mild sharpen + upscale so EasyOCR can read small plates."""
    if region_bgr is None or region_bgr.size == 0:
        return None
    gray = cv2.cvtColor(region_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    # Plates are small in 720p frames — force a minimum working width.
    min_w = 320
    if w < min_w:
        scale = min_w / float(w)
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    elif w < 640:
        gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    # Local contrast helps dark plates on bright bumpers (and vice versa).
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    gray = cv2.bilateralFilter(gray, 5, 50, 50)
    return gray


def _ocr_image_for_plates(img_gray: np.ndarray) -> list:
    """Run EasyOCR on a preprocessed grayscale plate region."""
    ocr = _get_ocr()
    try:
        results = ocr.readtext(
            img_gray,
            contrast_ths=0.3,
            adjust_contrast=0.4,
            width_ths=0.6,
            height_ths=0.4,
            mag_ratio=1.5,
            allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -",
        )
    except TypeError:
        # Older EasyOCR without allowlist/mag_ratio kwargs.
        results = ocr.readtext(img_gray)
    return results or []


def _best_from_ocr_results(results: list) -> Tuple[Optional[str], float]:
    best_rank = 0
    best_plate = None
    best_conf = 0.0
    fallback_plate = None
    fallback_conf = 0.0

    for _bbox_ocr, text, conf in results:
        if conf < OCR_CONFIDENCE_THRESHOLD:
            continue
        rank, scored_conf = _score_plate_candidate(text, conf)
        if rank == 0:
            continue
        cleaned = text.strip().upper().replace("  ", " ")
        if rank > best_rank or (rank == best_rank and scored_conf > best_conf):
            best_rank = rank
            best_plate = cleaned
            best_conf = scored_conf
        if rank == 1 and (fallback_plate is None or conf > fallback_conf):
            fallback_plate = cleaned
            fallback_conf = conf

    if best_plate is not None:
        return best_plate, best_conf
    return fallback_plate, fallback_conf


def _candidate_rois(frame, bbox: list) -> list:
    """
    Multiple ROIs — the plate sits low on the vehicle; the full-car crop is
    dominated by windows/signs that EasyOCR misreads as plates.
    """
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = [int(c) for c in bbox]
    bw = max(1, x2 - x1)
    bh = max(1, y2 - y1)

    pad_x = int(bw * 0.08)
    # Asymmetric vertical pad: plates are on the bumper (bottom).
    top_pad = int(bh * 0.02)
    bot_pad = int(bh * 0.20)

    full = (
        max(0, x1 - pad_x),
        max(0, y1 - top_pad),
        min(w, x2 + pad_x),
        min(h, y2 + bot_pad),
    )
    # Lower 45% of the vehicle — primary plate zone.
    lower_y1 = max(0, y1 + int(bh * 0.55))
    lower = (
        max(0, x1 - pad_x),
        lower_y1,
        min(w, x2 + pad_x),
        min(h, y2 + bot_pad),
    )
    # Bottom 30% strip (rear/front bumper line).
    strip_y1 = max(0, y2 - int(bh * 0.35))
    strip = (
        max(0, x1),
        strip_y1,
        min(w, x2),
        min(h, y2 + bot_pad),
    )

    rois = []
    for rect in (lower, strip, full):
        rx1, ry1, rx2, ry2 = rect
        if rx2 - rx1 < 8 or ry2 - ry1 < 6:
            continue
        rois.append(frame[ry1:ry2, rx1:rx2])
    return rois


def _read_plate_from_crop(frame, bbox: list) -> Tuple[Optional[str], float]:
    """
    Run OCR on plate-oriented ROIs (lower vehicle first), return best plate.
    Scoring: strict format match > confident free-text with digits.
    """
    best_plate = None
    best_rank = 0
    best_conf = 0.0

    for roi in _candidate_rois(frame, bbox):
        processed = _preprocess_plate_region(roi)
        if processed is None:
            continue
        results = _ocr_image_for_plates(processed)
        plate, conf = _best_from_ocr_results(results)
        if not plate:
            continue
        rank, scored_conf = _score_plate_candidate(plate, conf)
        if rank == 0:
            continue
        if rank > best_rank or (rank == best_rank and scored_conf > best_conf):
            best_rank = rank
            best_plate = plate
            best_conf = scored_conf
        # Strong format match on the primary (lower) ROI — stop early.
        if rank == 2 and best_conf >= 0.4:
            break

    return best_plate, best_conf


def _add_plate_vote(track: TrackState, plate: str, conf: float) -> None:
    """
    Accumulate a vote under the normalized key. Near-identical OCR variants
    (distance ≤1 or confusion-normalized match) merge onto the existing key so
    CCA2101 / CC42101 / CCA 2101 count as the same plate.
    """
    key = _normalize_plate_key(plate)
    if not key:
        return
    merged = _merge_ocr_variants(key)

    target = None
    for existing in track.plate_votes:
        if existing == key or existing == merged or _merge_ocr_variants(existing) == merged:
            target = existing
            break
        # Same length, one character difference → likely OCR noise.
        if abs(len(existing) - len(key)) <= 1 and _plate_similarity(existing, key) <= 1:
            target = existing
            break

    if target is None:
        track.plate_votes[key] += 1
        track.plate_conf_votes[key].append(round(conf, 3))
    else:
        track.plate_votes[target] += 1
        track.plate_conf_votes[target].append(round(conf, 3))


def _plate_vote_result(track: TrackState) -> Tuple[Optional[str], float, int]:
    """Final plate = mode (most votes); prefer format-valid keys on ties."""
    if not track.plate_votes:
        return None, 0.0, 0

    def sort_key(item):
        key, votes = item
        fmt = 1 if _validate_plate_format(_format_plate(key)) else 0
        conf_mean = (
            sum(track.plate_conf_votes.get(key, [])) / len(track.plate_conf_votes[key])
            if track.plate_conf_votes.get(key)
            else 0.0
        )
        return (votes, fmt, conf_mean)

    best_key = max(track.plate_votes.items(), key=sort_key)[0]
    votes = track.plate_votes[best_key]
    confs = track.plate_conf_votes.get(best_key, [])
    mean_conf = round(sum(confs) / len(confs), 3) if confs else 0.0
    return _format_plate(best_key), mean_conf, votes


def _ocr_and_maybe_finalize(frame, track: TrackState) -> Tuple[bool, Optional[str], float]:
    """
    Run one OCR attempt on a confirmed track and decide whether to finalize.
    Returns (finalized, plate, conf).
    """
    track.ocr_attempts += 1
    plate, conf = _read_plate_from_crop(frame, track.bbox)
    if plate:
        _add_plate_vote(track, plate, conf)
        logger.info(
            f"[AI] Track {track.track_id} OCR vote {track.ocr_attempts}/{OCR_MAX_ATTEMPTS}: "
            f"{plate} ({conf:.1%})"
        )
    else:
        logger.info(
            f"[AI] Track {track.track_id} OCR attempt {track.ocr_attempts}/{OCR_MAX_ATTEMPTS}: no plate"
        )

    voted_plate, voted_conf, votes = _plate_vote_result(track)

    # Enough consistent votes → finalize with mode.
    if voted_plate is not None and votes >= PLATE_VOTE_MIN:
        return True, voted_plate, voted_conf

    # No plate yet and retries exhausted → finalize as no-plate.
    if voted_plate is None and track.ocr_attempts >= OCR_MAX_ATTEMPTS:
        return True, None, 0.0

    # Plate votes exist but below PLATE_VOTE_MIN and retries remain → keep trying.
    if voted_plate is not None and track.ocr_attempts >= OCR_MAX_ATTEMPTS:
        return True, voted_plate, voted_conf

    return False, voted_plate, voted_conf


def _attach_frame_stats(
    result: dict,
    session_id: Optional[str],
    processing_ms: float,
    detection_count: int,
    track_count: int,
    started_at: float,
) -> None:
    """Attach honest per-frame stats and emit the required frame log line."""
    _record_completion(session_id)
    if session_id:
        _session_frame_numbers[session_id] = _session_frame_numbers.get(session_id, 0) + 1
        frame_number = _session_frame_numbers[session_id]
        ai_fps = _measure_ai_fps(_session_completion.get(session_id))
    else:
        frame_number = sum(_session_frame_numbers.values()) or len(_completion_times)
        ai_fps = _measure_ai_fps(_completion_times)

    ts = _now_iso()
    stats = {
        "sessionId": session_id,
        "frameNumber": frame_number,
        "timestamp": ts,
        "processingMs": round(processing_ms, 1),
        "aiFps": ai_fps,
        "targetAiFps": cfg.TARGET_AI_FPS,
        "frameIntervalMs": cfg.FRAME_INTERVAL_MS,
        "detectionCount": detection_count,
        "trackCount": track_count,
        "confirmationFrames": CONFIRMATION_FRAMES,
        "vehicleConfidenceThreshold": VEHICLE_CONFIDENCE_THRESHOLD,
        "ocrConfidenceThreshold": OCR_CONFIDENCE_THRESHOLD,
        "alertCooldownSeconds": cfg.ALERT_COOLDOWN,
    }
    result["frameStats"] = stats

    logger.info(
        f"[AI-FRAME] node/session={session_id or 'none'} | frame={frame_number} | "
        f"ts={ts} | procMs={stats['processingMs']} | dets={detection_count} | "
        f"tracks={track_count} | aiFps={ai_fps} (target {cfg.TARGET_AI_FPS})"
    )


def detect_from_image(image_bytes: bytes, session_id: Optional[str] = None) -> dict:
    """
    Run the full detection + tracking pipeline on raw image bytes.

    If session_id is provided, uses session-based tracking to deduplicate vehicles
    with multi-frame confirmation and OCR voting.
    """
    started = time.time()
    result = {
        "vehicleDetected": False,
        "vehicles": [],
        "plateDetected": False,
        "plateNumber": None,
        "ocrConfidence": 0.0,
        "personDetected": False,
        "status": "NO_VEHICLE",
        "trackingInfo": None,
        "processedTracks": [],
        "frameStats": None,
    }
    detection_count = 0
    track_count = 0

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            logger.error("[AI] Failed to decode image bytes")
            result["status"] = "ERROR"
            return result

        h, w = frame.shape[:2]
        current_time = time.time()
        logger.info(f"[AI] Frame received ({w}x{h})")

        # --- Stage 1: YOLO Vehicle Detection + Tracking ---
        if session_id:
            yolo = _get_yolo_for_session(session_id)
            detections_result = yolo.track(
                frame,
                persist=True,
                classes=list(VEHICLE_CLASS_IDS | {PERSON_CLASS_ID}),
                verbose=False,
                tracker="bytetrack.yaml",
                conf=VEHICLE_CONFIDENCE_THRESHOLD,
                imgsz=cfg.YOLO_IMGSZ,
            )
        else:
            yolo = _get_yolo()
            detections_result = yolo(
                frame,
                verbose=False,
                classes=list(VEHICLE_CLASS_IDS | {PERSON_CLASS_ID}),
                conf=VEHICLE_CONFIDENCE_THRESHOLD,
                imgsz=cfg.YOLO_IMGSZ,
            )

        all_objects = []
        vehicle_detections = []
        person_count = 0

        for det in detections_result:
            if det.boxes is None:
                continue
            for box in det.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                class_name = CLASS_NAMES.get(cls_id, f"class_{cls_id}")

                track_id = None
                if hasattr(box, 'id') and box.id is not None:
                    track_id = int(box.id[0])

                obj = {
                    "class": class_name,
                    "classId": cls_id,
                    "confidence": round(conf, 3),
                    "boundingBox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                    "trackId": track_id,
                }
                all_objects.append(obj)

                if cls_id == PERSON_CLASS_ID:
                    person_count += 1

                if cls_id in VEHICLE_CLASS_IDS and conf >= VEHICLE_CONFIDENCE_THRESHOLD:
                    vehicle_detections.append(obj)

        detection_count = len(vehicle_detections)

        obj_summary = ", ".join(
            f"{obj['class']} {obj['confidence']:.2f}(t{obj['trackId']})" if obj['trackId']
            else f"{obj['class']} {obj['confidence']:.2f}"
            for obj in all_objects
        ) if all_objects else "none"
        logger.info(f"[AI] Objects detected: {obj_summary}")
        logger.info(f"[AI] Vehicle count: {len(vehicle_detections)}, Person count: {person_count}")

        # --- Stage 2: Person only ---
        if person_count > 0 and len(vehicle_detections) == 0:
            result["personDetected"] = True
            result["status"] = "PERSON_DETECTED"
            logger.info("[AI] Person detected, no vehicle found")
            return result

        if len(vehicle_detections) == 0:
            result["status"] = "NO_VEHICLE"
            logger.info("[AI] No vehicle detected in frame")
            return result

        result["vehicleDetected"] = True
        result["vehicles"] = vehicle_detections
        result["status"] = "VEHICLE_DETECTED"

        # --- Stage 3: Session-based tracking with multi-frame confirmation ---
        if session_id:
            session = get_session(session_id)
            processable, pending = session.update_tracks(vehicle_detections, current_time)

            total_active = len([t for t in session.active_tracks.values() if t.active])
            total_processed = len(session.processed_track_ids)
            track_count = total_active

            result["trackingInfo"] = {
                "sessionId": session_id,
                "totalActiveTracks": total_active,
                "totalProcessedTracks": total_processed,
                "newTrackIds": [t.track_id for t in processable],
                "pendingConfirmationTrackIds": [t.track_id for t in pending],
                "processedTrackIds": [],
                "processedTrackId": None,
                "duplicatePlate": None,
                "confirmationFrames": CONFIRMATION_FRAMES,
            }

            if not processable:
                if pending:
                    # Vehicles present but not yet confirmed across enough frames.
                    result["status"] = "AWAITING_CONFIRMATION"
                    logger.info(
                        f"[AI] {len(pending)} track(s) awaiting confirmation "
                        f"(hits < {CONFIRMATION_FRAMES}) — skipping report"
                    )
                else:
                    result["status"] = "ALL_VEHICLES_TRACKED"
                    logger.info(
                        f"[AI] All {len(vehicle_detections)} vehicle(s) already tracked — skipping"
                    )
                return result

            processed_tracks = []
            first_time_plates = []

            for track in sorted(processable, key=lambda t: t.confidence, reverse=True):
                logger.info(
                    f"[AI] Processing CONFIRMED track {track.track_id} "
                    f"({track.class_name}, {track.confidence:.1%}, hits={track.hits})"
                )

                finalized, plate, plate_conf = _ocr_and_maybe_finalize(frame, track)

                if not finalized:
                    # More OCR votes needed on later frames — do not report yet.
                    logger.info(
                        f"[AI] Track {track.track_id} awaiting more OCR votes "
                        f"(attempts={track.ocr_attempts}, votes={dict(track.plate_votes)})"
                    )
                    continue

                entry = {
                    "trackId": track.track_id,
                    "class": track.class_name,
                    "confidence": round(track.confidence, 3),
                    "plateNumber": None,
                    "ocrConfidence": 0.0,
                    "status": "VEHICLE_DETECTED_NO_PLATE",
                    "ocrAttempts": track.ocr_attempts,
                    "plateVotes": dict(track.plate_votes),
                    "confirmationHits": track.hits,
                }

                if plate:
                    if session.is_duplicate_plate(plate):
                        entry["status"] = "DUPLICATE_PLATE"
                        session.mark_processed(track.track_id, plate)
                        result["trackingInfo"]["duplicatePlate"] = plate
                        logger.info(
                            f"[AI] Track {track.track_id} plate {plate} duplicates an earlier "
                            f"track — suppressed"
                        )
                    else:
                        entry["plateNumber"] = plate
                        entry["ocrConfidence"] = round(plate_conf, 3)
                        entry["status"] = "PLATE_READ"
                        session.mark_processed(track.track_id, plate)
                        first_time_plates.append((entry, track))
                        logger.info(
                            f"[AI] Track {track.track_id} FINAL plate (mode): {plate} "
                            f"({plate_conf:.1%}, votes={dict(track.plate_votes)})"
                        )
                else:
                    session.mark_processed(track.track_id)
                    logger.info(f"[AI] Track {track.track_id}: no plate after {track.ocr_attempts} attempt(s)")

                processed_tracks.append(entry)

            if not processed_tracks:
                # Confirmed tracks still collecting OCR votes.
                result["status"] = "AWAITING_CONFIRMATION"
                return result

            processed_ids = [e["trackId"] for e in processed_tracks]
            result["trackingInfo"]["processedTrackIds"] = processed_ids

            if first_time_plates:
                best_entry, best_track = first_time_plates[0]
                result["plateDetected"] = True
                result["plateNumber"] = best_entry["plateNumber"]
                result["ocrConfidence"] = best_entry["ocrConfidence"]
                result["status"] = "PLATE_READ"
                result["trackingInfo"]["processedTrackId"] = best_track.track_id
            elif any(e["status"] == "DUPLICATE_PLATE" for e in processed_tracks):
                result["status"] = "DUPLICATE_PLATE"
                result["trackingInfo"]["processedTrackId"] = processed_ids[0]
            else:
                result["status"] = "VEHICLE_DETECTED_NO_PLATE"
                result["trackingInfo"]["processedTrackId"] = processed_ids[0]

            result["processedTracks"] = processed_tracks
            session.cleanup()

        else:
            # No session — process the best vehicle (legacy mode, single OCR pass)
            best_vehicle = max(vehicle_detections, key=lambda v: v["confidence"])
            plate, plate_conf = _read_plate_from_crop(frame, best_vehicle["boundingBox"])

            if plate:
                result["plateDetected"] = True
                result["plateNumber"] = plate
                result["ocrConfidence"] = round(plate_conf, 3)
                result["status"] = "PLATE_READ"
                logger.info(f"[AI] Plate OCR result: {plate} ({plate_conf:.1%})")
            else:
                result["status"] = "VEHICLE_DETECTED_NO_PLATE"
                logger.info("[AI] Vehicle detected but no readable plate")

        return result

    except Exception as e:
        logger.exception(f"[AI] Detection pipeline error: {e}")
        result["status"] = "ERROR"
        return result
    finally:
        processing_ms = (time.time() - started) * 1000
        try:
            _attach_frame_stats(
                result,
                session_id,
                processing_ms,
                detection_count,
                track_count,
                started,
            )
        except Exception as stats_err:
            logger.warning(f"[AI] Failed to attach frame stats: {stats_err}")
