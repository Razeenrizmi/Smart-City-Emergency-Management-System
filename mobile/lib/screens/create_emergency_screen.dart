import 'package:flutter/material.dart';
import '../models/route.dart';
import '../models/emergency_session.dart';
import '../services/emergency_service.dart';
import 'emergency_session_screen.dart';

class CreateEmergencyScreen extends StatefulWidget {
  final Route? selectedRoute;

  const CreateEmergencyScreen({
    super.key,
    this.selectedRoute,
  });

  @override
  State<CreateEmergencyScreen> createState() => _CreateEmergencyScreenState();
}

class _CreateEmergencyScreenState extends State<CreateEmergencyScreen> {
  final EmergencyService _emergencyService = EmergencyService();
  final _formKey = GlobalKey<FormState>();
  final _driverIdController = TextEditingController();
  final _vehicleTypeController = TextEditingController();
  
  bool _isLoading = false;
  String? _errorMessage;
  String? _successMessage;

  @override
  void dispose() {
    _driverIdController.dispose();
    _vehicleTypeController.dispose();
    _emergencyService.dispose();
    super.dispose();
  }

  bool _isValidGuid(String value) {
    final guidRegex = RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    );
    return guidRegex.hasMatch(value);
  }

  Future<void> _createEmergencySession() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final session = await _emergencyService.createEmergencySession(
        driverId: _driverIdController.text.trim(),
        vehicleType: _vehicleTypeController.text.trim(),
        selectedRouteId: widget.selectedRoute?.routeId,
      );

      setState(() {
        _isLoading = false;
        _successMessage = 'Emergency session created successfully';
      });

      // Navigate to emergency session screen
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => EmergencySessionScreen(session: session),
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Emergency Session'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.selectedRoute != null) ...[
                _buildSelectedRouteCard(),
                const SizedBox(height: 24),
              ],
              _buildDriverIdField(),
              const SizedBox(height: 16),
              _buildVehicleTypeField(),
              const SizedBox(height: 24),
              _buildErrorMessage(),
              const SizedBox(height: 16),
              _buildSubmitButton(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSelectedRouteCard() {
    final route = widget.selectedRoute!;
    return Card(
      color: Colors.green.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.green),
                const SizedBox(width: 8),
                Text(
                  'Selected Route',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.green.shade800,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              route.routeName,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${route.startLocation} → ${route.destination}',
              style: const TextStyle(fontSize: 14),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.info_outline, size: 16),
                const SizedBox(width: 4),
                Text(
                  'This route will be used for the emergency session',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.green.shade800,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDriverIdField() {
    return TextFormField(
      controller: _driverIdController,
      decoration: const InputDecoration(
        labelText: 'Driver ID',
        hintText: 'Enter your Driver ID (GUID format)',
        prefixIcon: Icon(Icons.person),
        border: OutlineInputBorder(),
      ),
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Driver ID is required';
        }
        if (!_isValidGuid(value.trim())) {
          return 'Please enter a valid GUID format (e.g., 123e4567-e89b-12d3-a456-426614174000)';
        }
        return null;
      },
    );
  }

  Widget _buildVehicleTypeField() {
    return TextFormField(
      controller: _vehicleTypeController,
      decoration: const InputDecoration(
        labelText: 'Vehicle Type',
        hintText: 'Enter vehicle type (e.g., Ambulance, Fire Truck)',
        prefixIcon: Icon(Icons.directions_car),
        border: OutlineInputBorder(),
      ),
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Vehicle type is required';
        }
        if (value.trim().length > 100) {
          return 'Vehicle type must be 100 characters or less';
        }
        return null;
      },
    );
  }

  Widget _buildErrorMessage() {
    if (_errorMessage == null) {
      return const SizedBox.shrink();
    }

    return Card(
      color: Colors.red.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(Icons.error, color: Colors.red),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                _errorMessage!,
                style: TextStyle(color: Colors.red.shade900),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: _isLoading ? null : _createEmergencySession,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.red,
          foregroundColor: Colors.white,
        ),
        child: _isLoading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : const Text(
                'Create Emergency Session',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
      ),
    );
  }
}
