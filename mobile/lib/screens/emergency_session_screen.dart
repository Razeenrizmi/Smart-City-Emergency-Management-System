import 'package:flutter/material.dart';
import '../models/emergency_session.dart';
import '../models/green_wave_activation_response.dart';
import '../services/emergency_service.dart';

class EmergencySessionScreen extends StatefulWidget {
  final EmergencySession session;

  const EmergencySessionScreen({
    super.key,
    required this.session,
  });

  @override
  State<EmergencySessionScreen> createState() => _EmergencySessionScreenState();
}

class _EmergencySessionScreenState extends State<EmergencySessionScreen> {
  final EmergencyService _emergencyService = EmergencyService();
  
  bool _isActivating = false;
  String? _activationError;
  GreenWaveActivationResponse? _activationResponse;

  @override
  void dispose() {
    _emergencyService.dispose();
    super.dispose();
  }

  Future<void> _activateGreenWave() async {
    setState(() {
      _isActivating = true;
      _activationError = null;
    });

    try {
      final response = await _emergencyService.activateGreenWave(widget.session.sessionId);
      setState(() {
        _isActivating = false;
        _activationResponse = response;
      });
    } catch (e) {
      setState(() {
        _isActivating = false;
        _activationError = e.toString();
      });
    }
  }

  bool _canActivateGreenWave() {
    return widget.session.status.toUpperCase() == 'ACTIVE' && 
           widget.session.selectedRouteId != null &&
           _activationResponse == null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency Session'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildStatusCard(),
            const SizedBox(height: 16),
            _buildSessionDetailsCard(),
            const SizedBox(height: 16),
            _buildGreenWaveSection(),
            const SizedBox(height: 16),
            _buildInfoCard(),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard() {
    Color statusColor;
    IconData statusIcon;

    switch (widget.session.status.toUpperCase()) {
      case 'ACTIVE':
        statusColor = Colors.green;
        statusIcon = Icons.check_circle;
        break;
      case 'COMPLETED':
        statusColor = Colors.blue;
        statusIcon = Icons.done_all;
        break;
      case 'CANCELLED':
        statusColor = Colors.red;
        statusIcon = Icons.cancel;
        break;
      default:
        statusColor = Colors.grey;
        statusIcon = Icons.help;
    }

    return Card(
      color: statusColor.withOpacity(0.1),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Icon(statusIcon, color: statusColor, size: 48),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Session Status',
                    style: TextStyle(fontSize: 14, color: Colors.grey),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.session.status,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: statusColor,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSessionDetailsCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Session Details',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            _buildDetailRow('Session ID', widget.session.sessionId),
            _buildDetailRow('Driver ID', widget.session.driverId),
            _buildDetailRow('Vehicle Type', widget.session.vehicleType),
            if (widget.session.selectedRouteId != null)
              _buildDetailRow('Selected Route ID', widget.session.selectedRouteId!),
          ],
        ),
      ),
    );
  }

  Widget _buildGreenWaveSection() {
    // Show route requirement message if no route selected
    if (widget.session.selectedRouteId == null) {
      return Card(
        color: Colors.orange.shade50,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.warning_amber, color: Colors.orange.shade700),
                  const SizedBox(width: 8),
                  Text(
                    'Green Wave Activation',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Text(
                'A selected route with junctions is required to activate Green Wave.',
                style: TextStyle(fontSize: 14),
              ),
            ],
          ),
        ),
      );
    }

    // Show activation button for ACTIVE sessions
    if (_canActivateGreenWave()) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.traffic, color: Colors.green.shade700),
                  const SizedBox(width: 8),
                  Text(
                    'Green Wave Activation',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isActivating ? null : _activateGreenWave,
                  icon: _isActivating
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Icon(Icons.play_arrow),
                  label: _isActivating ? 'Activating...' : 'Activate Green Wave',
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Show activation error
    if (_activationError != null) {
      return Card(
        color: Colors.red.shade50,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.error, color: Colors.red),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Activation Failed',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                _activationError!,
                style: const TextStyle(fontSize: 14, color: Colors.red.shade900),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: _activateGreenWave,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red.shade700,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Show activation success/results
    if (_activationResponse != null) {
      return _buildActivationResultsCard();
    }

    // Session not ACTIVE or already activated
    if (widget.session.status.toUpperCase() != 'ACTIVE') {
      return Card(
        color: Colors.grey.shade100,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(Icons.info, color: Colors.grey.shade700),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Green Wave activation is only available for ACTIVE sessions.',
                  style: const TextStyle(fontSize: 14, color: Colors.grey.shade700),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildActivationResultsCard() {
    final response = _activationResponse!;
    return Card(
      color: Colors.green.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.check_circle, color: Colors.green.shade700),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Green Wave Active',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Colors.green.shade900,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildActivationDetailRow('Route Name', response.routeName),
            if (response.routeId != null)
              _buildActivationDetailRow('Route ID', response.routeId!),
            _buildActivationDetailRow('Status', response.status),
            const SizedBox(height: 16),
            Text(
              'Activated Junctions',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            if (response.junctions.isEmpty)
              const Text('No junctions activated')
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: response.junctions.length,
                separatorBuilder: (context, index) => const Divider(),
                itemBuilder: (context, index) {
                  final junction = response.junctions[index];
                  return _buildActivatedJunctionItem(junction);
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildActivatedJunctionItem(ActivatedJunctionInfo junction) {
    Color signalColor;
    switch (junction.signalState.toUpperCase()) {
      case 'GREEN':
        signalColor = Colors.green;
        break;
      case 'RED':
        signalColor = Colors.red;
        break;
      case 'YELLOW':
        signalColor = Colors.orange;
        break;
      default:
        signalColor = Colors.grey;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: signalColor,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                '${junction.sequenceNumber}',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  junction.junctionName,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  'Signal: ${junction.signalState}',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.grey,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildActivationDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
          Text(value),
        ],
      ),
    );
  }

  Widget _buildInfoCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.info_outline, color: Colors.blue.shade700),
                const SizedBox(width: 8),
                Text(
                  'Session Information',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildInfoRow('Created At', _formatDateTime(widget.session.createdAt)),
            _buildInfoRow('Updated At', _formatDateTime(widget.session.updatedAt)),
          ],
        ),
      ),
    );
  }

  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.toLocal().toIso8601String().split('.')[0]} '
        '${dateTime.toLocal().timeZoneName}';
  }
}
