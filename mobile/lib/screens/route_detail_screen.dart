import 'package:flutter/material.dart';
import '../models/route.dart';
import '../models/route_junction.dart';
import '../services/route_service.dart';
import 'create_emergency_screen.dart';

class RouteDetailScreen extends StatefulWidget {
  final Route route;

  const RouteDetailScreen({
    super.key,
    required this.route,
  });

  @override
  State<RouteDetailScreen> createState() => _RouteDetailScreenState();
}

class _RouteDetailScreenState extends State<RouteDetailScreen> {
  final RouteService _routeService = RouteService();
  Route? _detailedRoute;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadRouteDetails();
  }

  @override
  void dispose() {
    _routeService.dispose();
    super.dispose();
  }

  Future<void> _loadRouteDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final detailedRoute = await _routeService.getRouteById(widget.route.routeId);
      setState(() {
        _detailedRoute = detailedRoute;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.route.routeName),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.emergency),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => CreateEmergencyScreen(
                    selectedRoute: widget.route,
                  ),
                ),
              );
            },
            tooltip: 'Create Emergency',
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 64,
                color: Colors.red,
              ),
              const SizedBox(height: 16),
              Text(
                'Error loading route details',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loadRouteDetails,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_detailedRoute == null) {
      return const Center(
        child: Text('No route data available'),
      );
    }

    final route = _detailedRoute!;
    final sortedJunctions = List<RouteJunction>.from(route.junctions)
      ..sort((a, b) => a.sequenceNumber.compareTo(b.sequenceNumber));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildRouteInfoCard(route),
          const SizedBox(height: 16),
          _buildJunctionsSection(sortedJunctions),
          const SizedBox(height: 24),
          _buildCreateEmergencyButton(),
        ],
      ),
    );
  }

  Widget _buildRouteInfoCard(Route route) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.location_on, color: Colors.green),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Start: ${route.startLocation}',
                    style: const TextStyle(fontSize: 16),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.location_on, color: Colors.red),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Destination: ${route.destination}',
                    style: const TextStyle(fontSize: 16),
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            _buildInfoRow('Distance', '${route.distanceKm.toStringAsFixed(1)} km'),
            _buildInfoRow('Estimated Time', '${route.estimatedTimeMinutes} min'),
            _buildInfoRow('Traffic Level', route.trafficLevel),
            _buildInfoRow('Junctions', '${route.junctions.length}'),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
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

  Widget _buildJunctionsSection(List<RouteJunction> junctions) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.traffic, color: Colors.blue),
                const SizedBox(width: 8),
                Text(
                  'Traffic Junctions',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (junctions.isEmpty)
              const Text('No junctions available for this route')
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: junctions.length,
                separatorBuilder: (context, index) => const Divider(),
                itemBuilder: (context, index) {
                  final junction = junctions[index];
                  return _buildJunctionItem(junction, index + 1);
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildJunctionItem(RouteJunction junction, int displayNumber) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                '$displayNumber',
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
                Row(
                  children: [
                    _buildSignalBadge(junction.currentSignalState),
                    const SizedBox(width: 8),
                    Text(
                      'Seq: ${junction.sequenceNumber}',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Lat: ${junction.latitude.toStringAsFixed(4)}, '
                  'Lng: ${junction.longitude.toStringAsFixed(4)}',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSignalBadge(String signalState) {
    Color badgeColor;
    switch (signalState.toUpperCase()) {
      case 'GREEN':
        badgeColor = Colors.green;
        break;
      case 'RED':
        badgeColor = Colors.red;
        break;
      case 'YELLOW':
        badgeColor = Colors.orange;
        break;
      default:
        badgeColor = Colors.grey;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: badgeColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        signalState,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildCreateEmergencyButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => CreateEmergencyScreen(
                selectedRoute: widget.route,
              ),
            ),
          );
        },
        icon: const Icon(Icons.emergency),
        label: const Text('Create Emergency Session'),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.red,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
      ),
    );
  }
}
