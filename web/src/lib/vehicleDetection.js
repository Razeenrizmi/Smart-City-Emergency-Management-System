// Client-side vehicle detection for uploaded CCTV test footage.
//
// Runs a pretrained EfficientDet-Lite2 model, via Google's MediaPipe Tasks
// Vision SDK, entirely in the browser: no backend call, no server-side
// video processing. This stands in for a real camera/edge-device feed — a
// production deployment would run detection on the camera or in an
// ingestion service and POST the resulting count to /api/telemetry, which
// is the same shape this module returns.
//
// EfficientDet-Lite2 replaces an earlier COCO-SSD/MobileNetV2 attempt —
// COCO-SSD is a 2017-era architecture that missed a meaningful number of
// real vehicles even after tiling; EfficientDet-Lite2 is Google's current
// actively-maintained web detector and is both more accurate and higher
// input resolution (448x448 vs COCO-SSD's 300x300), which matters a lot
// for the small/distant vehicles a wide junction shot is full of.
const VEHICLE_CLASSES = new Set(['car', 'truck', 'bus', 'motorcycle']);
const MIN_SCORE = 0.3;
// Lowered from 6 — total detect() calls scale with
// roadCount × SAMPLE_COUNT × tiles, so with more roads (e.g. 6) this is
// the single biggest lever for total scan time without touching the
// tiling that fixed small-vehicle undercounting. Still enough samples to
// reasonably catch the peak-traffic moment in a clip.
const SAMPLE_COUNT = 4;
const MAX_BOXES_PER_TILE = 40;

const WASM_FILESET_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite';

// COCO-SSD resizes whatever it's given down to a small fixed input before
// detecting, so a single pass over a full wide-angle junction frame shrinks
// distant/small vehicles to a handful of pixels and misses most of them —
// this is the actual cause of "many cars visible, few detected" on CCTV
// footage. Splitting the frame into overlapping tiles and detecting each
// tile separately gives the model far more effective resolution per
// vehicle; the overlap plus IoU merge below stops cars that straddle a
// tile boundary from being counted twice — merging only ever compares
// detections from *different* tiles, since two distinct vehicles sitting
// close together within the same tile can legitimately have overlapping
// boxes (e.g. queued traffic) and must not be collapsed into one.
const TILE_GRID = { cols: 3, rows: 3 };
const TILE_OVERLAP_RATIO = 0.15;
const MERGE_IOU_THRESHOLD = 0.3;

let detectorPromise = null;

async function createDetector(vision, delegate) {
  const { ObjectDetector } = await import('@mediapipe/tasks-vision');
  return ObjectDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_ASSET_URL, delegate },
    scoreThreshold: MIN_SCORE,
    maxResults: MAX_BOXES_PER_TILE,
    runningMode: 'IMAGE',
  });
}

export function loadDetectionModel(onStatusChange) {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      onStatusChange?.('loading-runtime');
      const { FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_FILESET_URL);

      onStatusChange?.('loading-model');
      // GPU (WebGL) inference is typically several times faster than CPU
      // for this model, which matters a lot given how many detect() calls
      // one scan makes (tiled frames × samples × roads). Not every
      // machine/browser has a solid WebGL ML path though, so fall back to
      // CPU — slower but reliable — if GPU init fails for any reason.
      let detector;
      try {
        detector = await createDetector(vision, 'GPU');
      } catch {
        detector = await createDetector(vision, 'CPU');
      }
      onStatusChange?.('ready');
      return detector;
    })().catch((err) => {
      detectorPromise = null;
      onStatusChange?.('error');
      throw err;
    });
  }
  return detectorPromise;
}

function waitForLoadedMetadata(video) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1) return resolve();
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    video.addEventListener(
      'error',
      () => {
        const code = video.error?.code;
        reject(new Error(`Could not read video metadata.${code ? ` (MediaError code ${code})` : ''}`));
      },
      { once: true },
    );
  });
}

// Builds a <video> for the given file and waits until it's actually ready
// to sample from. A clip handed straight off a "connect camera" recording
// can occasionally fail this on the very first attempt — the browser can
// still be settling the blob it just finished writing a moment earlier —
// so one retry with a completely fresh <video>/blob URL is attempted
// before treating it as a genuinely unreadable file.
async function createReadyVideo(file, attempt = 1) {
  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  // A detached (not-in-document) <video> is unreliable for metadata
  // loading and frame-accurate seeking in some Chromium builds — keeping
  // it out of the layout (off-screen, zero-size) but attached to the DOM
  // fixes intermittent "could not read video metadata" / stuck-seek
  // failures without making it visible to the user.
  video.style.position = 'fixed';
  video.style.left = '-9999px';
  video.style.width = '1px';
  video.style.height = '1px';
  document.body.appendChild(video);

  try {
    await waitForLoadedMetadata(video);
    await fixInfiniteDuration(video);
    return video;
  } catch (err) {
    URL.revokeObjectURL(video.src);
    video.remove();
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 300));
      return createReadyVideo(file, attempt + 1);
    }
    throw err;
  }
}

// A video recorded via MediaRecorder (our "connect camera" clips) commonly
// reports duration as Infinity/NaN right after loadedmetadata — Chrome
// hasn't finished indexing the file yet. Until that resolves, the video
// can appear frozen/black and won't seek properly, which breaks both
// normal playback and the sampling below (duration * fraction = NaN).
// Seeking far past the end forces Chrome to finish computing the real
// duration; once it fires 'durationchange' with a finite value, the seek
// is undone. A plain upload's duration is already finite, so this
// resolves immediately for that case.
export function fixInfiniteDuration(video) {
  return new Promise((resolve) => {
    if (Number.isFinite(video.duration)) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('durationchange', onDurationChange);
      clearTimeout(timeoutId);
      video.currentTime = 0;
      resolve();
    };
    const onDurationChange = () => {
      if (Number.isFinite(video.duration)) finish();
    };

    video.addEventListener('durationchange', onDurationChange);
    const timeoutId = setTimeout(finish, 1500);
    video.currentTime = 1e101;
  });
}

// Seeks the video to `time` and resolves once the frame at that position
// is actually decoded. Two defenses against hanging forever:
//  1. If we're already effectively at that time (e.g. the extra warm-up
//     seek added to seed direction tracking lands within the same
//     decoded frame as a later sample, which can happen at low sample
//     fps), setting currentTime may not fire 'seeked' at all — skip
//     waiting in that case instead of listening for an event that never
//     comes.
//  2. A hard timeout as a last resort for any other browser/codec quirk
//     that swallows the event, so a single bad seek can't stall the
//     whole scan indefinitely.
function seekTo(video, time) {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.01) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', finish);
      clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = setTimeout(finish, 1000);

    video.addEventListener('seeked', finish, { once: true });
    video.currentTime = time;
  });
}

function computeTileRects(width, height) {
  const tileW = width / TILE_GRID.cols;
  const tileH = height / TILE_GRID.rows;
  const overlapX = tileW * TILE_OVERLAP_RATIO;
  const overlapY = tileH * TILE_OVERLAP_RATIO;
  const rects = [];
  for (let row = 0; row < TILE_GRID.rows; row += 1) {
    for (let col = 0; col < TILE_GRID.cols; col += 1) {
      const x0 = Math.max(0, col * tileW - overlapX);
      const y0 = Math.max(0, row * tileH - overlapY);
      const x1 = Math.min(width, (col + 1) * tileW + overlapX);
      const y1 = Math.min(height, (row + 1) * tileH + overlapY);
      rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  return rects;
}

function intersectionOverUnion(a, b) {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const x2 = Math.min(ax + aw, bx + bw);
  const y2 = Math.min(ay + ah, by + bh);
  const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const unionArea = aw * ah + bw * bh - interArea;
  return unionArea > 0 ? interArea / unionArea : 0;
}

// Same real-world vehicle detected in two overlapping tiles produces two
// boxes at (almost) the same full-frame position — drop the weaker one.
// Detections from the *same* tile are never compared: the model already
// ran its own NMS within that tile, so two overlapping boxes there are
// two genuinely distinct (e.g. adjacent, queued) vehicles, not a duplicate.
function mergeOverlappingDetections(detections) {
  const bySeenScoreDesc = [...detections].sort((a, b) => b.score - a.score);
  const kept = [];
  bySeenScoreDesc.forEach((det) => {
    const isDuplicate = kept.some(
      (k) =>
        k.tileIndex !== det.tileIndex &&
        k.class === det.class &&
        intersectionOverUnion(k.bbox, det.bbox) > MERGE_IOU_THRESHOLD,
    );
    if (!isDuplicate) kept.push(det);
  });
  return kept;
}

function detectVehiclesInFrame(detector, frameCanvas, tileCanvas, tileCtx) {
  const tiles = computeTileRects(frameCanvas.width, frameCanvas.height);
  const allDetections = [];

  for (let tileIndex = 0; tileIndex < tiles.length; tileIndex += 1) {
    const tile = tiles[tileIndex];
    tileCanvas.width = tile.w;
    tileCanvas.height = tile.h;
    tileCtx.drawImage(frameCanvas, tile.x, tile.y, tile.w, tile.h, 0, 0, tile.w, tile.h);

    // ObjectDetector.detect() is synchronous in IMAGE running mode —
    // scoreThreshold/maxResults were already set when the detector was
    // created, so they don't need to be passed per call here.
    const { detections } = detector.detect(tileCanvas);
    detections
      .filter((d) => VEHICLE_CLASSES.has(d.categories[0].categoryName))
      .forEach((d) => {
        const { originX, originY, width, height } = d.boundingBox;
        allDetections.push({
          class: d.categories[0].categoryName,
          score: d.categories[0].score,
          bbox: [originX + tile.x, originY + tile.y, width, height],
          tileIndex,
        });
      });
  }

  return mergeOverlappingDetections(allDetections);
}

// Single full-frame pass (no tiling) — used for the live-playback overlay,
// where "keep up with the video" matters more than catching every small,
// distant vehicle. The authoritative count used for the signal decision
// still comes from scanVideoForVehicles()'s full tiled multi-sample scan;
// this is a lighter, real-time approximation for visual feedback only.
export function detectVehiclesOnce(detector, canvas) {
  const { detections } = detector.detect(canvas);
  return detections
    .filter((d) => VEHICLE_CLASSES.has(d.categories[0].categoryName))
    .map((d) => ({
      class: d.categories[0].categoryName,
      score: d.categories[0].score,
      bbox: [d.boundingBox.originX, d.boundingBox.originY, d.boundingBox.width, d.boundingBox.height],
    }));
}

// Only vehicles heading toward the junction (still needing a green light)
// should count — a vehicle that has already passed through and is
// driving away shouldn't add to that road's demand. A single static
// frame can't tell direction on its own, so this compares a vehicle's
// box to its best match in the *previous* sample: a box that has grown
// is getting closer to the camera (approaching), one that has shrunk is
// moving away (departing). This assumes the camera faces oncoming
// traffic — the normal setup for a junction-approach camera, looking
// down the road at vehicles driving toward the stop line.
//
// A vehicle whose size barely changed (stopped/queued at a red light,
// very common right at a junction) is NOT treated as departing — only a
// clear shrink counts as "moving away". A vehicle with no match in the
// previous sample (just entered frame, or samples are far apart) is
// counted by default rather than discarded, since undercounting real
// queued demand is worse than occasionally counting a vehicle that
// turns out to be leaving.
const DEPARTING_SHRINK_THRESHOLD = 0.08; // >8% box-area shrink vs. previous sample

function findClosestMatch(vehicle, previousVehicles) {
  const [x, y, w, h] = vehicle.bbox;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const maxDim = Math.max(w, h);

  let match = null;
  let bestDist = Infinity;
  previousVehicles.forEach((prev) => {
    if (prev.class !== vehicle.class) return;
    const [px, py, pw, ph] = prev.bbox;
    const dist = Math.hypot(cx - (px + pw / 2), cy - (py + ph / 2));
    // A real match shouldn't have jumped further than roughly its own
    // size between samples — otherwise it's more likely a different
    // vehicle that happens to be nearby.
    if (dist < maxDim * 1.5 && dist < bestDist) {
      bestDist = dist;
      match = prev;
    }
  });
  return match;
}

function isDeparting(vehicle, previousVehicles) {
  const match = findClosestMatch(vehicle, previousVehicles);
  if (!match) return false;
  const currentArea = vehicle.bbox[2] * vehicle.bbox[3];
  const previousArea = match.bbox[2] * match.bbox[3];
  return (currentArea - previousArea) / previousArea < -DEPARTING_SHRINK_THRESHOLD;
}

export function drawDetections(ctx, detections) {
  ctx.lineWidth = 3;
  ctx.font = '16px sans-serif';
  detections.forEach(({ bbox, class: cls, score }) => {
    const [x, y, w, h] = bbox;
    ctx.strokeStyle = '#22c55e';
    ctx.strokeRect(x, y, w, h);
    const label = `${cls} ${(score * 100).toFixed(0)}%`;
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x, Math.max(0, y - 18), textWidth + 8, 18);
    ctx.fillStyle = '#05210f';
    ctx.fillText(label, x + 4, Math.max(14, y - 4));
  });
}

// Detected vehicle count is the peak number of *approaching* vehicles
// seen at once across sampled frames — a snapshot count, matching how a
// real camera telemetry reading works (junction_camera_telemetry
// .detected_vehicle_count is a point-in-time count, not a running total
// across the clip). Vehicles classified as departing (see isDeparting
// above) are excluded from both the count and the drawn boxes.
export async function scanVideoForVehicles(file, { onProgress } = {}) {
  const detector = await loadDetectionModel();
  const video = await createReadyVideo(file);

  try {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = video.videoWidth || 640;
    frameCanvas.height = video.videoHeight || 360;
    const frameCtx = frameCanvas.getContext('2d');

    const tileCanvas = document.createElement('canvas');
    const tileCtx = tileCanvas.getContext('2d');

    let best = { count: 0, thumbnail: null };
    const samples = [];

    // Seed the tracker with one throwaway frame taken slightly before the
    // first *reported* sample. Without this, the first reported sample
    // would have no earlier frame to compare against and would fall back
    // to counting everything — including a vehicle that's already driving
    // away right from the start of the clip. This warm-up frame is never
    // itself counted or shown, only used as a comparison baseline for
    // direction tracking, so it uses the cheap single-pass (non-tiled)
    // detection instead of the full 9-tile scan — a faster, slightly
    // less precise reference is enough for that job.
    const firstSampleTime = duration > 0 ? (duration * 0.5) / SAMPLE_COUNT : 0;
    const warmupTime = firstSampleTime / 2;
    await seekTo(video, warmupTime);
    frameCtx.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);
    let previousVehicles = detectVehiclesOnce(detector, frameCanvas);

    for (let i = 0; i < SAMPLE_COUNT; i += 1) {
      const t = duration > 0 ? (duration * (i + 0.5)) / SAMPLE_COUNT : 0;
      await seekTo(video, t);
      frameCtx.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);


      const allVehicles = detectVehiclesInFrame(detector, frameCanvas, tileCanvas, tileCtx);
      const approachingVehicles = allVehicles.filter((v) => !isDeparting(v, previousVehicles));

      samples.push({ time: t, count: approachingVehicles.length });
      onProgress?.({ sampleIndex: i, sampleCount: SAMPLE_COUNT, count: approachingVehicles.length });

      if (approachingVehicles.length >= best.count) {
        drawDetections(frameCtx, approachingVehicles);
        best = {
          count: approachingVehicles.length,
          thumbnail: frameCanvas.toDataURL('image/jpeg', 0.75),
        };
        // frameCanvas is redrawn fresh from video at the top of the next
        // iteration, so this overlay doesn't leak into the next sample.
      }

      previousVehicles = allVehicles;
      if (duration === 0) break;
    }

    return {
      vehicleCount: best.count,
      thumbnail: best.thumbnail,
      samples,
      scannedAt: new Date().toISOString(),
    };
  } finally {
    URL.revokeObjectURL(video.src);
    video.remove();
  }
}
