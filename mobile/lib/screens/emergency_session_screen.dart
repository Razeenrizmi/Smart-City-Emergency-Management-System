import 'package:flutter/material.dart';
import '../models/emergency_session.dart';
import '../models/green_wave_activation_response.dart';
import '../models/emergency_completion_response.dart';
import '../models/ai_workflow.dart';
import '../services/emergency_service.dart';

class EmergencySessionScreen extends StatefulWidget {
  final EmergencySession session;
  final EmergencyService? emergencyService;

  const EmergencySessionScreen({
    super.key,
    required this.session,
    this.emergencyService,
  });

  @override
  State<EmergencySessionScreen> createState() => _EmergencySessionScreenState();
}

class _EmergencySessionScreenState extends State<EmergencySessionScreen> {
  late final EmergencyService _emergencyService;
  late final bool _ownsEmergencyService;
  late EmergencySession _currentSession;
  AiWorkflow? _workflow;
  bool _isLoadingWorkflow = true;
  String? _workflowError;
  String? _sessionRefreshError;
  
  bool _isActivating = false;
  String? _activationError;
  GreenWaveActivationResponse? _activationResponse;
  
  bool _isCompleting = false;
  String? _completionError;
  EmergencyCompletionResponse? _completionResponse;
  
  bool _isCancelling = false;
  String? _cancellationError;
  EmergencySession? _cancelledSession;

  @override
  void initState() {
    super.initState();
    _emergencyService = widget.emergencyService ?? EmergencyService();
    _ownsEmergencyService = widget.emergencyService == null;
    _currentSession = widget.session;
    _refreshSessionData();
  }

  @override
  void dispose() {
    if (_ownsEmergencyService) {
      _emergencyService.dispose();
    }
    super.dispose();
  }

  Future<void> _refreshSessionData() async {
    setState(() {
      _isLoadingWorkflow = true;
      _workflowError = null;
      _sessionRefreshError = null;
    });

    try {
      EmergencySession latestSession = _currentSession;
      try {
        latestSession = await _emergencyService
            .getEmergencySessionById(widget.session.sessionId);
      } catch (e) {
        if (mounted) {
          _sessionRefreshError = e.toString();
        }
      }
      final workflow = await _emergencyService
          .getAiWorkflow(latestSession.sessionId);
      if (!mounted) return;
      setState(() {
        _currentSession = latestSession;
        _workflow = workflow;
        _isLoadingWorkflow = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoadingWorkflow = false;
        _workflowError = e.toString();
      });
    }
  }

  Future<void> _loadWorkflow() => _refreshSessionData();

  Future<void> _activateGreenWave() async {
    setState(() {
      _isActivating = true;
      _activationError = null;
    });

    try {
      final response = await _emergencyService.activateGreenWave(_currentSession.sessionId);
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

  Future<void> _completeEmergency() async {
    setState(() {
      _isCompleting = true;
      _completionError = null;
    });

    try {
      final response = await _emergencyService.completeEmergencySession(_currentSession.sessionId);
      setState(() {
        _isCompleting = false;
        _completionResponse = response;
      });
    } catch (e) {
      setState(() {
        _isCompleting = false;
        _completionError = e.toString();
      });
    }
  }

  Future<void> _cancelEmergency() async {
    setState(() {
      _isCancelling = true;
      _cancellationError = null;
    });

    try {
      final response = await _emergencyService.cancelEmergencySession(_currentSession.sessionId);
      setState(() {
        _isCancelling = false;
        _cancelledSession = response;
      });
    } catch (e) {
      setState(() {
        _isCancelling = false;
        _cancellationError = e.toString();
      });
    }
  }

  bool _canActivateGreenWave() {
    return _currentSession.status.toUpperCase() == 'ACTIVE' && 
           _currentSession.selectedRouteId != null &&
           _workflow?.approvalStatus.toUpperCase() == 'APPROVED' &&
           _workflow?.handoffReady == true &&
           _activationResponse == null &&
           _workflow?.signalExecutionPerformed != true;
  }

  bool _canCompleteEmergency() {
    return _currentSession.status.toUpperCase() == 'ACTIVE' && 
           _activationResponse != null &&
           _completionResponse == null &&
           _cancelledSession == null;
  }

  bool _canCancelEmergency() {
    return _currentSession.status.toUpperCase() == 'ACTIVE' && 
           _completionResponse == null &&
           _cancelledSession == null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency Session'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _isLoadingWorkflow ? null : _refreshSessionData,
            tooltip: 'Refresh session',
          ),
        ],
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
            _buildWorkflowStatusCard(),
            const SizedBox(height: 16),
            _buildGreenWaveSection(),
            const SizedBox(height: 16),
            _buildSessionActionsSection(),
            const SizedBox(height: 16),
            _buildInfoCard(),
          ],
        ),
      ),
    );
  }

  Widget _buildWorkflowStatusCard() {
    if (_isLoadingWorkflow) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Row(
            children: [
              SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
              SizedBox(width: 12),
              Text('Loading AI workflow status...'),
            ],
          ),
        ),
      );
    }

    if (_workflowError != null) {
      return Card(
        color: Colors.orange.shade50,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(Icons.warning_amber, color: Colors.orange),
              const SizedBox(width: 8),
              Expanded(child: Text('AI workflow status unavailable: $_workflowError')),
              TextButton(onPressed: _loadWorkflow, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    if (_workflow == null) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('No AI workflow has been generated yet.'),
        ),
      );
    }

    final workflow = _workflow!;
    return Column(
      children: [
        if (_sessionRefreshError != null)
          Card(
            color: Colors.orange.shade50,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber, color: Colors.orange),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Latest session status unavailable: $_sessionRefreshError')),
                  TextButton(onPressed: _refreshSessionData, child: const Text('Retry')),
                ],
              ),
            ),
          ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
            Text('AI Workflow Status', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            _buildInfoRow('Workflow', workflow.workflowStatus),
            _buildInfoRow('Proposal', workflow.proposalStatus),
            _buildInfoRow('Validation', workflow.isValid ? 'PASSED' : 'FAILED'),
            _buildInfoRow('Approval', workflow.approvalStatus),
            _buildInfoRow('Handoff', workflow.handoffReady ? 'READY' : 'NOT READY'),
            _buildInfoRow('Execution', workflow.signalExecutionPerformed ? 'PERFORMED' : 'NOT PERFORMED'),
            if (workflow.errorSummary != null) ...[
              const SizedBox(height: 8),
              Text(workflow.errorSummary!, style: TextStyle(color: Colors.red.shade700)),
            ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatusCard() {
    Color statusColor;
    IconData statusIcon;

    switch (_currentSession.status.toUpperCase()) {
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
                    _currentSession.status,
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
            _buildDetailRow('Session ID', _currentSession.sessionId),
            _buildDetailRow('Driver ID', _currentSession.driverId),
            _buildDetailRow('Vehicle Type', _currentSession.vehicleType),
            if (_currentSession.selectedRouteId != null)
              _buildDetailRow('Selected Route ID', _currentSession.selectedRouteId!),
          ],
        ),
      ),
    );
  }

  Widget _buildGreenWaveSection() {
    // Show route requirement message if no route selected
    if (_currentSession.selectedRouteId == null) {
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
                  label: Text(_isActivating ? 'Activating...' : 'Activate Green Wave'),
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

    final greenWaveActivated = _activationResponse != null ||
        _workflow?.signalExecutionPerformed == true;

    if (_currentSession.status.toUpperCase() == 'ACTIVE' && !greenWaveActivated) {
      return Card(
        color: Colors.orange.shade50,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            _workflow == null
                ? 'Generate and approve an AI proposal before activating Green Wave.'
                : 'Green Wave activation requires APPROVED AI workflow status and a READY handoff.',
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
                style: TextStyle(fontSize: 14, color: Colors.red.shade900),
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

    if (_currentSession.status.toUpperCase() == 'ACTIVE' && greenWaveActivated) {
      return Card(
        color: Colors.green.shade50,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(Icons.traffic, color: Colors.green.shade700),
              const SizedBox(width: 8),
              const Expanded(
                child: Text('Green Wave is currently active.'),
              ),
            ],
          ),
        ),
      );
    }

    // Session not ACTIVE or already activated
    if (_currentSession.status.toUpperCase() != 'ACTIVE') {
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
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
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
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
          Flexible(
            child: Text(value, textAlign: TextAlign.right),
          ),
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
            _buildInfoRow('Created At', _formatDateTime(_currentSession.createdAt)),
            _buildInfoRow('Updated At', _formatDateTime(_currentSession.updatedAt)),
          ],
        ),
      ),
    );
  }

  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.toLocal().toIso8601String().split('.')[0]} '
        '${dateTime.toLocal().timeZoneName}';
  }

  Widget _buildSessionActionsSection() {
    // Show completion error
    if (_completionError != null) {
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
                      'Completion Failed',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                _completionError!,
                style: TextStyle(fontSize: 14, color: Colors.red.shade900),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: _completeEmergency,
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

    // Show cancellation error
    if (_cancellationError != null) {
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
                      'Cancellation Failed',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                _cancellationError!,
                style: TextStyle(fontSize: 14, color: Colors.red.shade900),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: _cancelEmergency,
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

    // Show completion success
    if (_completionResponse != null) {
      return _buildCompletionResultsCard();
    }

    // Show cancellation success
    if (_cancelledSession != null) {
      return _buildCancellationResultsCard();
    }

    // Show action buttons for ACTIVE sessions
    if (_canCompleteEmergency() || _canCancelEmergency()) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.settings, color: Colors.blue.shade700),
                  const SizedBox(width: 8),
                  Text(
                    'Session Actions',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_canCompleteEmergency())
                _buildCompleteButton(),
              if (_canCompleteEmergency() && _canCancelEmergency())
                const SizedBox(height: 12),
              if (_canCancelEmergency())
                _buildCancelButton(),
            ],
          ),
        ),
      );
    }

    // Session not ACTIVE or already completed/cancelled
    if (_currentSession.status.toUpperCase() != 'ACTIVE') {
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
                  'Session actions are only available for ACTIVE sessions.',
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildCompleteButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: _isCompleting ? null : _completeEmergency,
        icon: _isCompleting
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : const Icon(Icons.done),
        label: Text(_isCompleting ? 'Completing...' : 'Complete Emergency'),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.blue,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
      ),
    );
  }

  Widget _buildCancelButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: _isCancelling ? null : _showCancellationConfirmation,
        icon: _isCancelling
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : const Icon(Icons.cancel),
        label: Text(_isCancelling ? 'Cancelling...' : 'Cancel Emergency'),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.red,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
      ),
    );
  }

  void _showCancellationConfirmation() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Cancel Emergency'),
          content: const Text(
            'Are you sure you want to cancel this emergency?\n\n'
            'WARNING: Cancelling the emergency does NOT restore or deactivate Green Wave signals. '
            'The signals will remain in their current state according to the backend behavior.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('No'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                _cancelEmergency();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
              ),
              child: const Text('Yes, Cancel'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildCompletionResultsCard() {
    final response = _completionResponse!;
    return Card(
      color: Colors.blue.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.done_all, color: Colors.blue.shade700),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Emergency Completed',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Colors.blue.shade900,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildCompletionDetailRow('Status', response.status),
            _buildCompletionDetailRow(
              'Green Wave Restored',
              response.greenWaveRestored ? 'Yes' : 'No',
            ),
            const SizedBox(height: 16),
            if (!response.greenWaveRestored)
              const Text(
                'No active Green Wave junctions needed restoration.',
                style: TextStyle(fontSize: 14, color: Colors.grey),
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Restored Junctions',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  if (response.restoredJunctions.isEmpty)
                    const Text('No junctions restored')
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: response.restoredJunctions.length,
                      separatorBuilder: (context, index) => const Divider(),
                      itemBuilder: (context, index) {
                        final junction = response.restoredJunctions[index];
                        return _buildRestoredJunctionItem(junction);
                      },
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildRestoredJunctionItem(RestoredJunctionInfo junction) {
    Color signalColor;
    switch (junction.restoredSignalState.toUpperCase()) {
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
              child: Icon(
                Icons.restore,
                color: Colors.white,
                size: 16,
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
                  'Restored to: ${junction.restoredSignalState}',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCancellationResultsCard() {
    return Card(
      color: Colors.red.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.cancel, color: Colors.red.shade700),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Emergency Cancelled',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Colors.red.shade900,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              'The emergency session has been cancelled.',
              style: TextStyle(fontSize: 14),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(Icons.warning_amber, color: Colors.orange.shade700, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Cancellation does NOT restore Green Wave signals. '
                      'Signals remain in their current state.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.orange.shade900,
                      ),
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

  Widget _buildCompletionDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
          Flexible(
            child: Text(value, textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
          Flexible(
            child: Text(value, textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }
}
