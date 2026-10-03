# Crime Vehicle Detection — Flutter Mobile Client

Android/iOS client for the **existing** ASP.NET backend + PostgreSQL database.
Monitoring screens plus a **live CCTV camera node** — the phone camera feeds the
same YOLO/OCR scan pipeline the web dashboard uses (no second backend).

## Architecture

```text
CCTV Cameras ─┐
Phone camera ─┼→ Existing Backend → AI Detection + OCR → Database
Web webcam  ──┘         ↓
          Web App  +  Flutter Mobile App  (same API, same DB)
```

**No authentication.** No login, register, JWT, password, or logout.

## Run

```bat
cd mobile
flutter pub get

:: Physical phone on same Wi-Fi — use your PC LAN IP (not localhost)
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:5017/api

:: Android emulator default (already built in)
flutter run
```

Build APK:

```bat
flutter build apk --dart-define=API_BASE_URL=http://192.168.1.20:5017/api
```

Camera permission: declared in `AndroidManifest.xml` (`CAMERA`) and
`ios/Runner/Info.plist` / `macos/Runner/Info.plist`
(`NSCameraUsageDescription`). On Android the app requests runtime permission
when you tap **START CAMERA**.

## Screens

| Tab | Data |
|---|---|
| Dashboard | `GET /api/dashboard/statistics`, `GET /api/detection/config` |
| CCTV | `GET /api/cctv/nodes` → detail `GET /api/cctv/nodes/{id}` |
| **Camera** | **Live device camera CCTV node** (see below) |
| Vehicles | `GET /api/detection/history?limit=40` (backend TrackIds only) |
| Alerts | Active `status=REQUIRES_OFFICER_REVIEW` + paged history |
| Map | Node lat/lng from backend (Google Maps tiles) |

Alert detail: `GET /api/crime-vehicle/logs/{logId}`

Refresh: polite 5s polling (backend has no WebSocket/SignalR).

## Live Camera tab (phone as CCTV)

The **Camera** tab (also reachable from CCTV node cards / detail) opens this
device's real camera and runs it as a detection node:

1. **START CAMERA** — real `CameraPreview` (back camera, 720p preset,
   Android runtime permission). Never fabricates a feed.
2. **START MONITORING** — `POST /api/cctv/nodes/{id}/start` issues
   `NODE{n}-SESSION-{seq}` (local `CCTV-...-N{id}` fallback if the backend is
   briefly unreachable), then frames are captured every
   `frameIntervalMs` (default **200 ms / 5 FPS**, from
   `GET /api/detection/config`) and posted to `POST /api/crime-vehicle/scan`
   (multipart `image` + `sessionId` + `nodeId`) — identical contract to the
   web LiveANPRMonitor.
3. Status pushes: `ONLINE` → `ANALYZING` per frame → `ONLINE`;
   **STOP MONITORING** ends the session; **STOP CAMERA** calls
   `POST /api/cctv/nodes/{id}/stop` (node OFFLINE).
4. Honest metrics only: **AI FPS** from server `frameStats.aiFps` (client
   completion-window fallback); **Stream FPS = `—`** (the camera plugin
   exposes no presented-frame callback — same honesty rule as web MJPEG).
5. Skip list (evidence rule): `ALL_VEHICLES_TRACKED`, `DUPLICATE_PLATE`,
   `ALREADY_PROCESSED`, `AWAITING_CONFIRMATION`, `isDuplicate` are never
   displayed as results.
6. Results are stored in the shared PostgreSQL — detections from the phone
   appear on the **web dashboard** too.

One client drives a node at a time — the backend ends dangling sessions when
another client starts the same node.

## Backend endpoints used (existing + small additions)

**Existing:** `/api/cctv/nodes`, `/api/cctv/nodes/{id}`,
`PUT /api/cctv/nodes/{id}/status`, `POST /api/cctv/nodes/{id}/start|stop`,
`POST /api/crime-vehicle/scan`, `POST /api/crime-vehicle/session/end`,
`/api/detection/config`, `/api/detection/history`, `/api/detection/node/{id}/active`,
`/api/detection/observations/{plate}`, `/api/crime-vehicle/logs`,
`/api/crime-vehicle/logs/{logId}`

**Added for this app:**
- `GET /api/dashboard/statistics` — node/alert/track aggregates + measured AI FPS from AI `/stats`
- `limit` / `offset` on `GET /api/detection/history` (+ `X-Total-Count`)
- `CctvNode.Lat` / `CctvNode.Lng` for the map

Dependencies: `camera`, `permission_handler` (Android runtime permission only —
iOS/macOS prompt natively from the usage-description keys).

## Tests

1. Open app → splash → dashboard (no login)
2. All backend CCTV nodes listed dynamically
3–4. Online nodes show status; AI FPS from backend (never faked)
5. Crime alert appears after backend match
6. Normal vehicles not marked crime
7. Nodes remain independent
8. One offline node does not break the rest
9. History loads new alerts
10. Network off → error + Reconnect, no crash
11. `scan_result_test.dart` — envelope parsing, duplicate/confirmation skip
    list, AI-outage status (no invented results)
12. Camera tab builds without a camera (permission/no-camera → error UI,
    never a fake preview)
