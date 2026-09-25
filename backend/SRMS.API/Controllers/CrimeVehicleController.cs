using System.Collections.Concurrent;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/crime-vehicle")]
public class CrimeVehicleController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private static readonly Random _rand = new();

    // Alert cooldown: same plate + node re-sighted within the window suppresses a re-alert.
    private static readonly ConcurrentDictionary<string, DateTime> _lastAlertAt = new();

    public CrimeVehicleController(
        AppDbContext context,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    private double AlertCooldownSeconds => _configuration.GetValue("Detection:AlertCooldownSeconds", 60.0);

    [HttpPost("scan")]
    [HttpPost("/api/detection/analyze")]
    public async Task<ActionResult<ApiResponse<ScanResultResponse>>> ScanImage(
        [FromForm] IFormFile image,
        [FromForm] string? testPlate = null,
        [FromForm] string? sessionId = null,
        [FromForm] int? trackId = null,
        [FromForm] int? nodeId = null)
    {
        if (image == null || image.Length == 0)
            return BadRequest(ApiResponse<ScanResultResponse>.Fail("No image uploaded"));

        using var ms = new MemoryStream();
        await image.CopyToAsync(ms);
        var imageBytes = ms.ToArray();

        // --- Resolve source CCTV node ---
        var resolvedNodeId = nodeId ?? 0;
        var node = resolvedNodeId > 0
            ? await _context.CctvNodes.FirstOrDefaultAsync(n => n.NodeId == resolvedNodeId)
            : null;
        var nodeCameraName = node?.CameraName ?? "Webcam ANPR Scanner";
        var nodeLocation = node?.Location ?? "Live Feed";
        var sessionLabel = sessionId ?? string.Empty;

        // Forward to Python AI detection service (session_id = per-node tracking context)
        AiDetectionResult? aiResult = null;
        try
        {
            aiResult = await CallAiDetectionService(imageBytes, image.FileName ?? "frame.jpg", sessionId);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AI] Detection service unavailable: {ex.Message}");
            return Ok(ApiResponse<ScanResultResponse>.Ok(
                BuildErrorResponse("AI detection service unavailable. Ensure the Python AI service is running.", "AI_SERVICE_UNAVAILABLE", resolvedNodeId, sessionLabel),
                "AI detection service unavailable"));
        }

        if (aiResult == null)
        {
            return Ok(ApiResponse<ScanResultResponse>.Ok(
                BuildErrorResponse("Failed to get response from AI detection service.", "AI_SERVICE_UNAVAILABLE", resolvedNodeId, sessionLabel),
                "AI detection service returned no data"));
        }

        Console.WriteLine($"[AI] Node {resolvedNodeId} | Status: {aiResult.Status}, Vehicles: {aiResult.Vehicles?.Count ?? 0}, Plate: {aiResult.PlateNumber ?? "null"}, Session: {sessionLabel}, ClientTrack: {trackId?.ToString() ?? "none"}");

        // --- Duplicate protection layer 1: client-supplied nodeId + sessionId + trackId ---
        if (!string.IsNullOrEmpty(sessionId) && trackId.HasValue)
        {
            var preExists = await _context.DetectionLogs.AnyAsync(d =>
                d.NodeId == resolvedNodeId && d.SessionId == sessionId && d.TrackId == trackId.Value);

            if (preExists)
            {
                Console.WriteLine($"[AI] Duplicate skipped — Node {resolvedNodeId}, Session {sessionId}, Track {trackId.Value} already processed");
                return Ok(ApiResponse<ScanResultResponse>.Ok(
                    BuildDuplicateResponse(resolvedNodeId, sessionLabel, trackId, $"Vehicle already processed (Node {resolvedNodeId}, Track {trackId.Value})"),
                    "Duplicate detection skipped"));
            }
        }

        // --- AI service session tracker: nothing new to analyze ---
        if (aiResult.Status == "ALL_VEHICLES_TRACKED")
        {
            var trackedResponse = BuildErrorResponse(
                "All vehicles in frame already tracked and processed.", "ALL_VEHICLES_TRACKED", resolvedNodeId, sessionLabel);
            trackedResponse.TrackingInfo = aiResult.TrackingInfo;
            trackedResponse.FrameStats = aiResult.FrameStats;
            return Ok(ApiResponse<ScanResultResponse>.Ok(trackedResponse, "All vehicles tracked"));
        }

        // --- Multi-frame confirmation: track not yet confirmed across enough frames ---
        if (aiResult.Status == "AWAITING_CONFIRMATION")
        {
            var awaitingResponse = BuildErrorResponse(
                "Vehicle track awaiting multi-frame confirmation.", "AWAITING_CONFIRMATION", resolvedNodeId, sessionLabel);
            awaitingResponse.TrackingInfo = aiResult.TrackingInfo;
            awaitingResponse.FrameStats = aiResult.FrameStats;
            awaitingResponse.VehicleInfo = "Awaiting confirmation frames before analysis.";
            return Ok(ApiResponse<ScanResultResponse>.Ok(awaitingResponse, "Awaiting track confirmation"));
        }

        // --- Stage: No vehicle / person only (never classified as a vehicle) ---
        if (!aiResult.VehicleDetected)
        {
            var status = aiResult.PersonDetected ? "PERSON_DETECTED" : "NO_VEHICLE";
            var message = aiResult.PersonDetected
                ? "Person detected. No vehicle detected."
                : "No vehicle detected in current frame.";

            var noVehicleResponse = new ScanResultResponse
            {
                LogId = $"LOG-{10000 + _rand.Next(90000)}",
                DetectedPlate = "NO_VEHICLE_DETECTED",
                Confidence = 0,
                PlateConfidence = 0,
                VehicleConfidence = 0,
                VehicleInfo = message,
                VehicleType = "N/A",
                VehicleColor = "N/A",
                IsMatch = false,
                CrimeStatus = "CLEARED",
                RiskLevel = "NONE",
                DetectionStatus = status,
                ValidationStatus = "CLEARED_BY_SAFETY_AGENT",
                NodeId = resolvedNodeId,
                SessionId = sessionLabel,
                TrackId = null,
                IsDuplicate = false,
                AgentStages = new List<AgentStageStatus>
                {
                    new() { StageName = "Coordinator Agent", Completed = true, Details = $"Frame received from node {resolvedNodeId}" },
                    new() { StageName = "Vehicle Detection Agent (YOLO/CNN)", Completed = true, Details = aiResult.PersonDetected ? "Person detected — not a vehicle" : "No vehicle or license plate detected in frame" },
                    new() { StageName = "Vehicle Tracking Agent", Completed = true, Details = "No vehicle tracks to process" },
                    new() { StageName = "Number Plate / OCR Agent", Completed = false, Details = "Skipped — No vehicle detected" },
                    new() { StageName = "Vehicle Matching Agent", Completed = false, Details = "Skipped — No license plate detected" },
                    new() { StageName = "Validation / Safety Agent", Completed = true, Details = "Cleared — Frame safe" },
                    new() { StageName = "Final Detection Result", Completed = true, Details = message }
                },
                ScannedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                TrackingInfo = aiResult.TrackingInfo,
                FrameStats = aiResult.FrameStats
            };

            return Ok(ApiResponse<ScanResultResponse>.Ok(noVehicleResponse, message));
        }

        // --- Build the per-track work list from the AI response ---
        var processedTracks = aiResult.ProcessedTracks ?? new List<AiProcessedTrack>();
        if (processedTracks.Count == 0)
        {
            // Legacy single-result path (manual capture without a tracking session)
            var best = aiResult.Vehicles?.OrderByDescending(v => v.Confidence).FirstOrDefault();
            processedTracks.Add(new AiProcessedTrack
            {
                TrackId = trackId,
                Class = best?.Class ?? "unknown",
                Confidence = best?.Confidence ?? 0,
                PlateNumber = aiResult.PlateDetected ? aiResult.PlateNumber : null,
                OcrConfidence = aiResult.OcrConfidence,
                Status = aiResult.Status
            });
        }

        var hotlist = await _context.HotlistVehicles.ToListAsync();

        // --- Duplicate protection layer 2 (backend): per node + session + track ---
        var entries = new List<(AiProcessedTrack Track, string? Plate, HotlistVehicle? Match, bool CooldownSuppressed)>();
        var duplicateCount = 0;
        var nextLogDbId = await _context.DetectionLogs.AnyAsync()
            ? await _context.DetectionLogs.MaxAsync(d => d.Id) + 1
            : 1;

        foreach (var t in processedTracks)
        {
            if (t.Status == "DUPLICATE_PLATE" || t.Status == "ALREADY_PROCESSED")
            {
                duplicateCount++;
                continue;
            }

            string? plate = string.IsNullOrWhiteSpace(t.PlateNumber)
                ? null
                : t.PlateNumber!.ToUpper().Trim();

            HotlistVehicle? match = null;
            if (plate != null)
            {
                var normalized = plate.Replace(" ", "");
                match = hotlist.FirstOrDefault(h =>
                    h.PlateNumber.Replace(" ", "").Equals(normalized, StringComparison.OrdinalIgnoreCase));
            }

            // Only plate observations are persisted (matches and cleared vehicles alike).
            if (plate == null)
            {
                entries.Add((t, null, null, false));
                continue;
            }

            // node + session + track must be unique in the database.
            if (t.TrackId.HasValue && !string.IsNullOrEmpty(sessionId))
            {
                var trackExists = await _context.DetectionLogs.AnyAsync(d =>
                    d.NodeId == resolvedNodeId && d.SessionId == sessionId && d.TrackId == t.TrackId.Value);
                if (trackExists)
                {
                    duplicateCount++;
                    Console.WriteLine($"[AI] Duplicate skipped — Node {resolvedNodeId}, Session {sessionId}, Track {t.TrackId.Value} already in DB");
                    continue;
                }
            }

            var vehicleConfPct = Math.Round(t.Confidence * 100, 1);
            var plateConfPct = Math.Round(t.OcrConfidence * 100, 1);
            var yoloClass = CapitalizeFirst(t.Class);
            var vehicleDesc = match != null
                ? $"{match.MakeModel} ({match.Color})"
                : $"{yoloClass} ({vehicleConfPct}% detected)";

            // --- Alert cooldown: same plate + node re-sighted within the window ---
            var cooldownSuppressed = false;
            if (match != null)
            {
                var cooldownKey = $"{resolvedNodeId}:{plate.Replace(" ", "")}";
                var now = DateTime.Now;
                if (_lastAlertAt.TryGetValue(cooldownKey, out var lastAt) &&
                    (now - lastAt).TotalSeconds < AlertCooldownSeconds)
                {
                    cooldownSuppressed = true;
                    Console.WriteLine(
                        $"[AI] Alert cooldown active — Node {resolvedNodeId}, plate {plate}: " +
                        $"{Math.Round((now - lastAt).TotalSeconds, 1)}s / {AlertCooldownSeconds}s");
                }
                else
                {
                    _lastAlertAt[cooldownKey] = now;
                }
            }

            var logIdStr = $"LOG-{10000 + _rand.Next(90000)}";

            _context.DetectionLogs.Add(new DetectionLog
            {
                Id = nextLogDbId++,
                LogId = logIdStr,
                Timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                PlateNumber = plate,
                CameraId = resolvedNodeId > 0 ? $"NODE-{resolvedNodeId}" : "WEBCAM-SCAN",
                CameraName = nodeCameraName,
                Location = nodeLocation,
                Confidence = plateConfPct,
                Speed = "N/A",
                Direction = "N/A",
                IsHotlistMatch = match != null,
                CrimeMatch = match != null,
                ThreatLevel = match?.ThreatLevel ?? "",
                VehicleDetails = vehicleDesc,
                Status = match != null
                    ? (cooldownSuppressed ? "COOLDOWN_SUPPRESSED" : "REQUIRES_OFFICER_REVIEW")
                    : "CLEARED",
                Snapshot = "",
                NodeId = resolvedNodeId,
                SessionId = sessionLabel,
                TrackId = t.TrackId,
                VehicleType = yoloClass,
                VehicleConfidence = vehicleConfPct,
                OcrConfidence = plateConfPct
            });

            entries.Add((t, plate, match, cooldownSuppressed));
        }

        if (entries.Count == 0)
        {
            if (duplicateCount > 0)
            {
                // Every analyzed track was already processed for this node + session.
                var dupResponse = BuildDuplicateResponse(resolvedNodeId, sessionLabel, trackId,
                    $"Vehicle already processed (Node {resolvedNodeId}, Session {sessionLabel})");
                dupResponse.TrackingInfo = aiResult.TrackingInfo;
                return Ok(ApiResponse<ScanResultResponse>.Ok(dupResponse, "Duplicate detection skipped"));
            }

            // Vehicles present, but no readable plate anywhere — evidence rule: never invent a plate.
            var noPlatePrimary = processedTracks[0];
            var noPlateClass = CapitalizeFirst(noPlatePrimary.Class);
            var noPlateConf = Math.Round(noPlatePrimary.Confidence * 100, 1);
            var noPlateResponse = new ScanResultResponse
            {
                LogId = $"LOG-{10000 + _rand.Next(90000)}",
                DetectedPlate = "NO_PLATE_DETECTED",
                Confidence = 0,
                PlateConfidence = 0,
                VehicleConfidence = noPlateConf,
                VehicleInfo = $"{noPlateClass} ({noPlateConf}% detected, No Plate Read)",
                VehicleType = noPlateClass,
                VehicleColor = "N/A",
                IsMatch = false,
                CrimeStatus = "NO_PLATE",
                RiskLevel = "NONE",
                DetectionStatus = aiResult.Status == "PLATE_UNREADABLE" ? "PLATE_UNREADABLE" : "VEHICLE_DETECTED_NO_PLATE",
                ValidationStatus = "CLEARED_NO_PLATE",
                NodeId = resolvedNodeId,
                SessionId = sessionLabel,
                TrackId = noPlatePrimary.TrackId,
                IsDuplicate = false,
                AgentStages = new List<AgentStageStatus>
                {
                    new() { StageName = "Coordinator Agent", Completed = true, Details = $"Frame received from node {resolvedNodeId} and dispatched to pipeline" },
                    new() { StageName = "Vehicle Detection Agent (YOLO/CNN)", Completed = true, Details = $"Detected: {noPlateClass} ({noPlateConf}% Confidence)" },
                    new() { StageName = "Vehicle Tracking Agent", Completed = true, Details = noPlatePrimary.TrackId.HasValue ? $"Track ID {noPlatePrimary.TrackId.Value} (session-scoped)" : "No tracker (manual capture)" },
                    new() { StageName = "Number Plate / OCR Agent", Completed = false, Details = aiResult.Status == "PLATE_UNREADABLE" ? "License plate detected but could not be read reliably" : "No license plate region identified" },
                    new() { StageName = "Vehicle Matching Agent", Completed = false, Details = "Skipped — No readable plate" },
                    new() { StageName = "Validation / Safety Agent", Completed = true, Details = "Cleared — No plate to match" },
                    new() { StageName = "Final Detection Result", Completed = true, Details = "Vehicle found but plate unreadable" }
                },
                ScannedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                TrackingInfo = aiResult.TrackingInfo,
                FrameStats = aiResult.FrameStats
            };
            return Ok(ApiResponse<ScanResultResponse>.Ok(noPlateResponse, "Vehicle detected, no plate readable"));
        }

        // --- Persist per-track detections (duplicate-safe) ---
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            Console.WriteLine($"[AI] Unique-index duplicate rejected insert: {ex.Message}");
            var dupResponse = BuildDuplicateResponse(resolvedNodeId, sessionLabel, trackId,
                "Vehicle already processed for this node + session + track");
            return Ok(ApiResponse<ScanResultResponse>.Ok(dupResponse, "Duplicate detection skipped"));
        }

        // --- Choose the primary analysis to present (prefer crime match, then plate reads) ---
        var primary = entries.FirstOrDefault(e => e.Match != null && !e.CooldownSuppressed);
        if (primary.Track == null) primary = entries.FirstOrDefault(e => e.Match != null);
        if (primary.Track == null) primary = entries.FirstOrDefault(e => e.Plate != null);
        if (primary.Track == null) primary = entries[0];

        var primaryPlate = primary.Plate;
        var primaryMatch = primary.Match;
        var primaryCooldown = primary.CooldownSuppressed;
        var pConf = Math.Round(primary.Track.OcrConfidence * 100, 1);
        var pVehicleConf = Math.Round(primary.Track.Confidence * 100, 1);
        var pClass = CapitalizeFirst(primary.Track.Class);
        var pLog = _context.DetectionLogs.Local.LastOrDefault(l =>
            l.NodeId == resolvedNodeId && l.SessionId == sessionLabel &&
            (primary.Track.TrackId.HasValue ? l.TrackId == primary.Track.TrackId : l.TrackId == null));

        var stages = new List<AgentStageStatus>
        {
            new() { StageName = "Coordinator Agent", Completed = true, Details = $"Frame received from node {resolvedNodeId} ({nodeCameraName})" },
            new() { StageName = "Vehicle Detection Agent (YOLO/CNN)", Completed = true, Details = $"Detected: {pClass} ({pVehicleConf}% Confidence)" },
            new() { StageName = "Vehicle Tracking Agent", Completed = true, Details = primary.Track.TrackId.HasValue ? $"Track ID {primary.Track.TrackId.Value} — only NEW tracks analyzed" : "No tracker (manual capture)" },
            new() { StageName = "Number Plate / OCR Agent", Completed = primaryPlate != null, Details = primaryPlate != null ? $"Extracted Plate OCR: {primaryPlate} ({pConf}% Confidence)" : "No readable plate" },
            new() { StageName = "Vehicle Matching Agent", Completed = primaryPlate != null, Details = primaryMatch != null ? (primaryCooldown ? $"HOTLIST MATCH suppressed by alert cooldown ({AlertCooldownSeconds:0}s): {primaryMatch.IncidentType}" : $"HOTLIST MATCH: {primaryMatch.IncidentType} ({primaryMatch.ThreatLevel} Risk)") : primaryPlate != null ? "Vehicle cleared — No match in database" : "Skipped — No readable plate" },
            new() { StageName = "Validation / Safety Agent", Completed = true, Details = primaryMatch != null ? (primaryCooldown ? "Re-alert suppressed — cooldown active; CrimeMatch retained" : "Requires Authorized Officer Verification") : "Auto-cleared by safety agent" },
            new() { StageName = "Final Detection Result", Completed = true, Details = "Pipeline execution finished" }
        };

        var response = new ScanResultResponse
        {
            LogId = pLog?.LogId ?? $"LOG-{10000 + _rand.Next(90000)}",
            DetectedPlate = primaryPlate ?? "NO_PLATE_DETECTED",
            Confidence = primaryPlate != null ? pConf : 0,
            PlateConfidence = primaryPlate != null ? pConf : 0,
            VehicleConfidence = pVehicleConf,
            VehicleInfo = primaryMatch != null
                ? $"{primaryMatch.MakeModel} ({primaryMatch.Color})"
                : primaryPlate != null
                    ? $"{pClass} ({pVehicleConf}% detected)"
                    : $"{pClass} ({pVehicleConf}% detected, No Plate Read)",
            VehicleType = primaryMatch != null ? "Identified" : pClass,
            VehicleColor = primaryMatch?.Color ?? "Unknown",
            IsMatch = primaryMatch != null,
            CrimeStatus = primaryMatch != null ? primaryMatch.IncidentType : primaryPlate != null ? "UNDER_REVIEW" : "NO_PLATE",
            RiskLevel = primaryMatch != null ? primaryMatch.ThreatLevel : "PENDING_REVIEW",
            DetectionStatus = primaryMatch != null
                ? (primaryCooldown ? "COOLDOWN_SUPPRESSED" : "POSSIBLE_CRIME_MATCH")
                : primaryPlate != null ? "PLATE_DETECTED"
                : aiResult.Status == "PLATE_UNREADABLE" ? "PLATE_UNREADABLE" : "VEHICLE_DETECTED_NO_PLATE",
            ValidationStatus = primaryMatch != null
                ? (primaryCooldown ? "COOLDOWN_SUPPRESSED" : "REQUIRES_OFFICER_REVIEW")
                : "CLEARED_BY_SAFETY_AGENT",
            AgentStages = stages,
            MatchedVehicle = primaryMatch != null ? new HotlistMatchResponse
            {
                PlateNumber = primaryMatch.PlateNumber,
                MakeModel = primaryMatch.MakeModel,
                Color = primaryMatch.Color,
                ThreatLevel = primaryMatch.ThreatLevel,
                IncidentType = primaryMatch.IncidentType,
                Status = primaryMatch.Status,
                Notes = primaryMatch.Notes
            } : null,
            ScannedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
            TrackingInfo = aiResult.TrackingInfo,
            FrameStats = aiResult.FrameStats,
            NodeId = resolvedNodeId,
            SessionId = sessionLabel,
            TrackId = primary.Track.TrackId,
            IsDuplicate = false,
            ProcessedTracks = entries.Select(e => new ProcessedTrackResult
            {
                TrackId = e.Track.TrackId,
                VehicleType = CapitalizeFirst(e.Track.Class),
                VehicleConfidence = Math.Round(e.Track.Confidence * 100, 1),
                PlateNumber = e.Plate,
                OcrConfidence = e.Plate != null ? Math.Round(e.Track.OcrConfidence * 100, 1) : 0,
                CrimeMatch = e.Match != null,
                CooldownSuppressed = e.CooldownSuppressed,
                LogId = _context.DetectionLogs.Local
                    .Where(l => l.NodeId == resolvedNodeId && l.SessionId == sessionLabel &&
                                (e.Track.TrackId.HasValue ? l.TrackId == e.Track.TrackId : l.TrackId == null))
                    .Select(l => l.LogId)
                    .LastOrDefault() ?? ""
            }).ToList()
        };

        if (duplicateCount > 0)
        {
            Console.WriteLine($"[AI] {duplicateCount} duplicate track(s) skipped for node {resolvedNodeId}");
        }

        return Ok(ApiResponse<ScanResultResponse>.Ok(response,
            primaryMatch != null
                ? (primaryCooldown
                    ? "Hotlist match retained — re-alert suppressed by cooldown"
                    : "Hotlist match detected — Officer review required")
                : "Vehicle clear"));
    }

    private async Task<AiDetectionResult?> CallAiDetectionService(byte[] imageBytes, string fileName, string? sessionId)
    {
        var client = _httpClientFactory.CreateClient("AIService");

        using var content = new MultipartFormDataContent();
        var imageContent = new ByteArrayContent(imageBytes);
        imageContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
        content.Add(imageContent, "image", fileName);

        if (!string.IsNullOrEmpty(sessionId))
        {
            content.Add(new StringContent(sessionId), "session_id");
        }

        var response = await client.PostAsync("/detect", content);
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<AiDetectionResult>();
    }

    private static ScanResultResponse BuildErrorResponse(string message, string status, int nodeId = 0, string sessionId = "")
    {
        return new ScanResultResponse
        {
            LogId = $"LOG-{DateTime.Now.Ticks}",
            DetectedPlate = "ERROR",
            Confidence = 0,
            PlateConfidence = 0,
            VehicleConfidence = 0,
            VehicleInfo = message,
            VehicleType = "N/A",
            VehicleColor = "N/A",
            IsMatch = false,
            CrimeStatus = "ERROR",
            RiskLevel = "NONE",
            DetectionStatus = status,
            ValidationStatus = "ERROR",
            NodeId = nodeId,
            SessionId = sessionId,
            TrackId = null,
            IsDuplicate = false,
            AgentStages = new List<AgentStageStatus>
            {
                new() { StageName = "Coordinator Agent", Completed = false, Details = message },
                new() { StageName = "Vehicle Detection Agent (YOLO/CNN)", Completed = false, Details = "Service unavailable" },
                new() { StageName = "Vehicle Tracking Agent", Completed = false, Details = "Service unavailable" },
                new() { StageName = "Number Plate / OCR Agent", Completed = false, Details = "Service unavailable" },
                new() { StageName = "Vehicle Matching Agent", Completed = false, Details = "Service unavailable" },
                new() { StageName = "Validation / Safety Agent", Completed = false, Details = "Service unavailable" },
                new() { StageName = "Final Detection Result", Completed = false, Details = message }
            },
            ScannedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
        };
    }

    /// <summary>
    /// Duplicate response required by the spec: { isDuplicate: true, status: "ALREADY_PROCESSED" }.
    /// </summary>
    private static ScanResultResponse BuildDuplicateResponse(int nodeId, string sessionId, int? trackId, string message)
    {
        var response = BuildErrorResponse(message, "ALREADY_PROCESSED", nodeId, sessionId);
        response.IsDuplicate = true;
        response.TrackId = trackId;
        response.ValidationStatus = "ALREADY_PROCESSED";
        response.AgentStages = new List<AgentStageStatus>
        {
            new() { StageName = "Coordinator Agent", Completed = true, Details = $"Frame received from node {nodeId}" },
            new() { StageName = "Vehicle Detection Agent (YOLO/CNN)", Completed = true, Details = "Vehicle matched an existing track" },
            new() { StageName = "Vehicle Tracking Agent", Completed = true, Details = $"nodeId={nodeId} + sessionId={sessionId} + trackId={trackId?.ToString() ?? "n/a"} already processed" },
            new() { StageName = "Number Plate / OCR Agent", Completed = false, Details = "Skipped — duplicate track" },
            new() { StageName = "Vehicle Matching Agent", Completed = false, Details = "Skipped — duplicate track" },
            new() { StageName = "Validation / Safety Agent", Completed = true, Details = "Duplicate suppressed — no new database record created" },
            new() { StageName = "Final Detection Result", Completed = true, Details = "ALREADY_PROCESSED" }
        };
        return response;
    }

    private static string CapitalizeFirst(string s)
    {
        if (string.IsNullOrEmpty(s)) return s;
        return char.ToUpper(s[0]) + s[1..];
    }

    // --- CRUD Endpoints (unchanged) ---

    [HttpGet("cameras")]
    public async Task<ActionResult<ApiResponse<List<Camera>>>> GetCameras()
    {
        var cameras = await _context.Cameras.ToListAsync();
        return Ok(ApiResponse<List<Camera>>.Ok(cameras));
    }

    [HttpGet("cameras/{cameraId}")]
    public async Task<ActionResult<ApiResponse<Camera>>> GetCamera(string cameraId)
    {
        var camera = await _context.Cameras.FirstOrDefaultAsync(c => c.CameraId == cameraId);
        if (camera == null)
            return NotFound(ApiResponse<Camera>.Fail("Camera not found"));
        return Ok(ApiResponse<Camera>.Ok(camera));
    }

    [HttpGet("hotlist")]
    public async Task<ActionResult<ApiResponse<List<HotlistVehicle>>>> GetHotlist()
    {
        var hotlist = await _context.HotlistVehicles.ToListAsync();
        return Ok(ApiResponse<List<HotlistVehicle>>.Ok(hotlist));
    }

    [HttpGet("hotlist/{vehicleId}")]
    public async Task<ActionResult<ApiResponse<HotlistVehicle>>> GetHotlistVehicle(string vehicleId)
    {
        var vehicle = await _context.HotlistVehicles.FirstOrDefaultAsync(h => h.VehicleId == vehicleId);
        if (vehicle == null)
            return NotFound(ApiResponse<HotlistVehicle>.Fail("Vehicle not found in hotlist"));
        return Ok(ApiResponse<HotlistVehicle>.Ok(vehicle));
    }

    [HttpPost("hotlist")]
    public async Task<ActionResult<ApiResponse<HotlistVehicle>>> AddHotlistVehicle([FromBody] HotlistVehicle vehicle)
    {
        var nextId = await _context.HotlistVehicles.AnyAsync()
            ? await _context.HotlistVehicles.MaxAsync(h => h.Id) + 1
            : 1;

        vehicle.Id = nextId;
        var ticks = DateTime.Now.Ticks.ToString();
        vehicle.VehicleId = $"HV-{ticks.Substring(ticks.Length - 4)}";

        _context.HotlistVehicles.Add(vehicle);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetHotlistVehicle), new { vehicleId = vehicle.VehicleId },
            ApiResponse<HotlistVehicle>.Ok(vehicle, "Vehicle added to hotlist"));
    }

    [HttpPut("hotlist/{vehicleId}/status")]
    public async Task<ActionResult<ApiResponse<HotlistVehicle>>> UpdateHotlistStatus(string vehicleId, [FromBody] StatusUpdateRequest request)
    {
        var vehicle = await _context.HotlistVehicles.FirstOrDefaultAsync(h => h.VehicleId == vehicleId);
        if (vehicle == null)
            return NotFound(ApiResponse<HotlistVehicle>.Fail("Vehicle not found in hotlist"));

        vehicle.Status = request.Status;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<HotlistVehicle>.Ok(vehicle, "Status updated"));
    }

    [HttpPut("hotlist/{vehicleId}")]
    public async Task<ActionResult<ApiResponse<HotlistVehicle>>> UpdateHotlistVehicle(string vehicleId, [FromBody] HotlistVehicle update)
    {
        var vehicle = await _context.HotlistVehicles.FirstOrDefaultAsync(h => h.VehicleId == vehicleId);
        if (vehicle == null)
            return NotFound(ApiResponse<HotlistVehicle>.Fail("Vehicle not found in hotlist"));

        vehicle.PlateNumber = update.PlateNumber;
        vehicle.MakeModel = update.MakeModel;
        vehicle.Color = update.Color;
        vehicle.ThreatLevel = update.ThreatLevel;
        vehicle.IncidentType = update.IncidentType;
        vehicle.WantedSince = update.WantedSince;
        vehicle.LastSeenCamera = update.LastSeenCamera;
        vehicle.OwnerName = update.OwnerName;
        vehicle.Status = update.Status;
        vehicle.Notes = update.Notes;
        vehicle.Image = update.Image;

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<HotlistVehicle>.Ok(vehicle, "Vehicle updated"));
    }

    [HttpDelete("hotlist/{vehicleId}")]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveFromHotlist(string vehicleId)
    {
        var vehicle = await _context.HotlistVehicles.FirstOrDefaultAsync(h => h.VehicleId == vehicleId);
        if (vehicle == null)
            return NotFound(ApiResponse<bool>.Fail("Vehicle not found in hotlist"));

        _context.HotlistVehicles.Remove(vehicle);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(true, "Vehicle removed from hotlist"));
    }

    [HttpGet("logs")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<ActionResult<ApiResponse<List<DetectionLog>>>> GetDetectionLogs()
    {
        Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
        Response.Headers["Pragma"] = "no-cache";
        Response.Headers["Expires"] = "0";

        var logs = await _context.DetectionLogs.OrderByDescending(d => d.Timestamp).ToListAsync();
        return Ok(ApiResponse<List<DetectionLog>>.Ok(logs));
    }

    [HttpGet("logs/{logId}")]
    public async Task<ActionResult<ApiResponse<DetectionLog>>> GetDetectionLog(string logId)
    {
        var log = await _context.DetectionLogs.FirstOrDefaultAsync(d => d.LogId == logId);
        if (log == null)
            return NotFound(ApiResponse<DetectionLog>.Fail("Log not found"));
        return Ok(ApiResponse<DetectionLog>.Ok(log));
    }

    [HttpPost("logs")]
    public async Task<ActionResult<ApiResponse<DetectionLog>>> AddDetectionLog([FromBody] DetectionLog logEntry)
    {
        var nextId = await _context.DetectionLogs.AnyAsync()
            ? await _context.DetectionLogs.MaxAsync(d => d.Id) + 1
            : 1;

        logEntry.Id = nextId;
        logEntry.LogId = $"LOG-{10000 + Random.Shared.Next(90000)}";

        _context.DetectionLogs.Add(logEntry);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetDetectionLog), new { logId = logEntry.LogId },
            ApiResponse<DetectionLog>.Ok(logEntry, "Detection log created"));
    }

    [HttpGet("patrols")]
    public async Task<ActionResult<ApiResponse<List<PatrolUnit>>>> GetPatrolUnits()
    {
        var patrols = await _context.PatrolUnits.ToListAsync();
        return Ok(ApiResponse<List<PatrolUnit>>.Ok(patrols));
    }

    [HttpGet("patrols/{unitId}")]
    public async Task<ActionResult<ApiResponse<PatrolUnit>>> GetPatrolUnit(string unitId)
    {
        var unit = await _context.PatrolUnits.FirstOrDefaultAsync(p => p.UnitId == unitId);
        if (unit == null)
            return NotFound(ApiResponse<PatrolUnit>.Fail("Patrol unit not found"));
        return Ok(ApiResponse<PatrolUnit>.Ok(unit));
    }

    [HttpPost("dispatch")]
    public async Task<ActionResult<ApiResponse<DispatchResult>>> DispatchPatrol([FromBody] DispatchRequest request)
    {
        var unit = await _context.PatrolUnits.FirstOrDefaultAsync(p => p.UnitId == request.UnitId);
        if (unit == null)
            return NotFound(ApiResponse<DispatchResult>.Fail("Patrol unit not found"));

        var log = await _context.DetectionLogs.FirstOrDefaultAsync(d => d.LogId == request.LogId);
        if (log == null)
            return NotFound(ApiResponse<DispatchResult>.Fail("Detection log not found"));

        unit.Status = "EN_ROUTE";
        unit.Eta = "3 mins";
        log.Status = "DISPATCHED";

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<DispatchResult>.Ok(new DispatchResult
        {
            Success = true,
            UnitId = request.UnitId,
            LogId = request.LogId,
            Message = $"Unit {unit.Callsign} dispatched to incident {request.LogId}"
        }, "Patrol unit dispatched"));
    }

    [HttpPut("logs/{logId}/approve")]
    [HttpPut("/api/detection/{logId}/approve")]
    public async Task<ActionResult<ApiResponse<DetectionLog>>> ApproveDetection(string logId)
    {
        var log = await _context.DetectionLogs.FirstOrDefaultAsync(d => d.LogId == logId || d.Id.ToString() == logId);
        if (log == null)
            return NotFound(ApiResponse<DetectionLog>.Fail("Detection log not found"));

        log.Status = "CONFIRMED_BY_OFFICER";
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<DetectionLog>.Ok(log, "Detection confirmed by authorized officer"));
    }

    [HttpPost("session/end")]
    public async Task<ActionResult<ApiResponse<bool>>> EndSession([FromForm] string sessionId)
    {
        // End matching detection sessions in the database
        var sessions = await _context.DetectionSessions
            .Where(s => s.SessionId == sessionId && s.Status == "ACTIVE")
            .ToListAsync();
        foreach (var s in sessions)
        {
            s.Status = "ENDED";
            s.EndedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        }
        if (sessions.Count > 0) await _context.SaveChangesAsync();

        // Notify AI service to clean up session (FastAPI expects form field "session_id")
        try
        {
            var client = _httpClientFactory.CreateClient("AIService");
            using var content = new MultipartFormDataContent();
            content.Add(new StringContent(sessionId), "session_id");
            await client.PostAsync("/session/end", content);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AI] Failed to end session on AI service: {ex.Message}");
        }

        return Ok(ApiResponse<bool>.Ok(true, $"Session {sessionId} ended"));
    }

    [HttpPut("logs/{logId}/reject")]
    [HttpPut("/api/detection/{logId}/reject")]
    public async Task<ActionResult<ApiResponse<DetectionLog>>> RejectDetection(string logId)
    {
        var log = await _context.DetectionLogs.FirstOrDefaultAsync(d => d.LogId == logId || d.Id.ToString() == logId);
        if (log == null)
            return NotFound(ApiResponse<DetectionLog>.Fail("Detection log not found"));

        log.Status = "REJECTED_BY_OFFICER";
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<DetectionLog>.Ok(log, "Detection rejected by authorized officer"));
    }
}

// --- Request / Response Models ---

public class StatusUpdateRequest
{
    public string Status { get; set; } = string.Empty;
}

public class DispatchRequest
{
    public string UnitId { get; set; } = string.Empty;
    public string LogId { get; set; } = string.Empty;
}

public class DispatchResult
{
    public bool Success { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string LogId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class AgentStageStatus
{
    public string StageName { get; set; } = string.Empty;
    public bool Completed { get; set; }
    public string Details { get; set; } = string.Empty;
}

public class ScanResultResponse
{
    public string LogId { get; set; } = string.Empty;
    public string DetectedPlate { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public double PlateConfidence { get; set; }
    public double VehicleConfidence { get; set; }
    public string VehicleInfo { get; set; } = string.Empty;
    public string VehicleType { get; set; } = string.Empty;
    public string VehicleColor { get; set; } = string.Empty;
    public bool IsMatch { get; set; }
    public string CrimeStatus { get; set; } = "CLEARED";
    public string RiskLevel { get; set; } = "LOW";
    public string DetectionStatus { get; set; } = "IDLE";
    public string ValidationStatus { get; set; } = "CLEARED_BY_SAFETY_AGENT";
    public List<AgentStageStatus> AgentStages { get; set; } = new();
    public HotlistMatchResponse? MatchedVehicle { get; set; }
    public string ScannedAt { get; set; } = string.Empty;
    public AiTrackingInfo? TrackingInfo { get; set; }
    public AiFrameStats? FrameStats { get; set; }

    // Multi-CCTV node context
    public int NodeId { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public int? TrackId { get; set; }
    public bool IsDuplicate { get; set; }
    public List<ProcessedTrackResult>? ProcessedTracks { get; set; }
}

public class ProcessedTrackResult
{
    public int? TrackId { get; set; }
    public string VehicleType { get; set; } = string.Empty;
    public double VehicleConfidence { get; set; }
    public string? PlateNumber { get; set; }
    public double OcrConfidence { get; set; }
    public bool CrimeMatch { get; set; }
    public bool CooldownSuppressed { get; set; }
    public string LogId { get; set; } = string.Empty;
}

public class HotlistMatchResponse
{
    public string PlateNumber { get; set; } = string.Empty;
    public string MakeModel { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public string ThreatLevel { get; set; } = string.Empty;
    public string IncidentType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}

// --- AI Service Response Model ---

public class AiDetectionResult
{
    public bool VehicleDetected { get; set; }
    public List<AiVehicle>? Vehicles { get; set; }
    public bool PlateDetected { get; set; }
    public string? PlateNumber { get; set; }
    public double OcrConfidence { get; set; }
    public bool PersonDetected { get; set; }
    public string Status { get; set; } = string.Empty;
    public AiTrackingInfo? TrackingInfo { get; set; }
    public List<AiProcessedTrack>? ProcessedTracks { get; set; }
    public AiFrameStats? FrameStats { get; set; }
}

public class AiFrameStats
{
    public string? SessionId { get; set; }
    public int FrameNumber { get; set; }
    public string Timestamp { get; set; } = string.Empty;
    public double ProcessingMs { get; set; }
    public double AiFps { get; set; }
    public int TargetAiFps { get; set; }
    public int FrameIntervalMs { get; set; }
    public int DetectionCount { get; set; }
    public int TrackCount { get; set; }
    public int ConfirmationFrames { get; set; }
    public double VehicleConfidenceThreshold { get; set; }
    public double OcrConfidenceThreshold { get; set; }
    public double AlertCooldownSeconds { get; set; }
}

public class AiProcessedTrack
{
    public int? TrackId { get; set; }
    public string Class { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public string? PlateNumber { get; set; }
    public double OcrConfidence { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class AiTrackingInfo
{
    public string SessionId { get; set; } = string.Empty;
    public int TotalActiveTracks { get; set; }
    public int TotalProcessedTracks { get; set; }
    public List<int>? NewTrackIds { get; set; }
    public List<int>? ProcessedTrackIds { get; set; }
    public List<int>? PendingConfirmationTrackIds { get; set; }
    public int? ProcessedTrackId { get; set; }
    public string? DuplicatePlate { get; set; }
    public int ConfirmationFrames { get; set; }
}

public class AiVehicle
{
    public string Class { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public List<double>? BoundingBox { get; set; }
}
