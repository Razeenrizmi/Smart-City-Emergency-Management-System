# Phase 8A: Flutter Mobile Foundation

## Summary
Phase 8A establishes the Flutter mobile application foundation for the Emergency Green Wave component.

## Files Created

### Configuration
- `lib/config/api_config.dart` - API base URL configuration with environment variable support

### Models
- `lib/models/emergency_session.dart` - Emergency session data model
- `lib/models/route.dart` - Route data model with junctions
- `lib/models/route_junction.dart` - Route junction data model
- `lib/models/green_wave_activation_response.dart` - Green Wave activation response model
- `lib/models/emergency_completion_response.dart` - Emergency completion response model

### Services
- `lib/services/emergency_service.dart` - Emergency session API service (create, get, activate, complete)
- `lib/services/route_service.dart` - Route API service (get all, get by ID)

### Screens
- `lib/screens/placeholder_screen.dart` - Placeholder screen for future development

### Widgets
- `lib/widgets/` - Directory created for future custom widgets

## Files Modified

### Main Application
- `lib/main.dart` - Updated from default counter app to Emergency Green Wave home screen

### Dependencies
- `pubspec.yaml` - Added `http: ^1.2.0` dependency for API communication

## Dependencies Added
- `http: ^1.2.0` - HTTP client for API communication

## Architecture Decisions

1. **No State Management Framework**: Keeping it simple for Phase 8A. Will add state management (Provider/Riverpod) in later phases if needed.

2. **Environment-Based Configuration**: API base URL uses `String.fromEnvironment` with default fallback for local development.

3. **Minimal HTTP Implementation**: Direct http.Client usage instead of higher-level packages (like dio) to keep dependencies minimal.

4. **Model-Centric Approach**: Each API response has corresponding Dart models with JSON serialization.

5. **Service Layer Pattern**: Separated API logic into service classes for better organization and testability.

## API Endpoints Implemented

### EmergencyService
- `createEmergencySession()` - POST /api/emergencies
- `getEmergencySessionById()` - GET /api/emergencies/{id}
- `activateGreenWave()` - POST /api/emergencies/{id}/activate-green-wave
- `completeEmergencySession()` - POST /api/emergencies/{id}/complete

### RouteService
- `getAllRoutes()` - GET /api/routes
- `getRouteById()` - GET /api/routes/{id}

## Configuration

### Local Development
Default API base URL: `http://localhost:5000/api`

### Environment Variables
To override the API base URL for different environments:
```bash
flutter run --dart-define=API_BASE_URL=https://your-api-url.com/api
```

## Next Steps (Phase 8B)
- Implement UI screens for emergency vehicle dashboard
- Add navigation structure
- Implement route selection interface
- Add Green Wave activation controls
- Add emergency completion flow

## Notes
- No authentication implemented yet (waiting for confirmed authentication API)
- No state management framework added yet
- No uuid package added (no concrete requirement discovered)
- Backend, web, and teammate components remain unchanged
- Database schema unchanged
- No EF migrations added
