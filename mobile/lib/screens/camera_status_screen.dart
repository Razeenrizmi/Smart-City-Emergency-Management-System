import 'dart:async';
import 'package:flutter/material.dart';
import '../api/srms_api.dart';
import '../congestion.dart';
import '../models/camera_status.dart';
import '../models/intersection_summary.dart';

// The traffic-inspector camera status view — a read-only mobile screen
// showing every junction's live camera density, pulled from the same
// backend the React Junction Control Panel uses. Worst-congestion-first,
// searchable, with a quick-glance summary header and per-road fault
// reporting.
class CameraStatusScreen extends StatefulWidget {
  const CameraStatusScreen({super.key});

  @override
  State<CameraStatusScreen> createState() => _CameraStatusScreenState();
}

class _CameraStatusScreenState extends State<CameraStatusScreen> {
  final _api = SrmsApi();
  List<IntersectionSummary> _intersections = [];
  bool _loading = true;
  String? _error;
  Timer? _pollTimer;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _refresh();
    // Same 5s cadence as the web panel's polling.
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _refresh());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final data = await _api.getIntersections();
      if (!mounted) return;
      setState(() {
        _intersections = data;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  List<IntersectionSummary> get _visibleIntersections {
    final filtered = _query.trim().isEmpty
        ? _intersections
        : _intersections.where((i) => i.name.toLowerCase().contains(_query.trim().toLowerCase())).toList();
    // Worst congestion first; ties keep the original (stable sort) order.
    return [...filtered]..sort(
        (a, b) => congestionSeverityRank[b.congestionLevel]!.compareTo(congestionSeverityRank[a.congestionLevel]!));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Camera Status')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _intersections.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            "Couldn't reach the backend: $_error",
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.red),
          ),
        ),
      );
    }

    if (_intersections.isEmpty) {
      return const Center(child: Text('No junctions in the database yet.'));
    }

    final visible = _visibleIntersections;

    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _SummaryHeader(intersections: _intersections),
          const SizedBox(height: 10),
          TextField(
            decoration: const InputDecoration(
              hintText: 'Search junctions…',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
              isDense: true,
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
          const SizedBox(height: 10),
          if (visible.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('No junctions match your search.')),
            )
          else
            for (final intersection in visible)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _JunctionCard(intersection: intersection),
              ),
        ],
      ),
    );
  }
}

class _SummaryHeader extends StatelessWidget {
  final List<IntersectionSummary> intersections;
  const _SummaryHeader({required this.intersections});

  @override
  Widget build(BuildContext context) {
    final counts = <String, int>{'SEVERE': 0, 'HIGH': 0, 'MODERATE': 0, 'LOW': 0};
    for (final i in intersections) {
      if (i.congestionLevel != null) counts[i.congestionLevel!] = (counts[i.congestionLevel!] ?? 0) + 1;
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          children: [
            Text('${intersections.length} junction${intersections.length == 1 ? '' : 's'}',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            const Spacer(),
            for (final level in ['SEVERE', 'HIGH', 'MODERATE', 'LOW'])
              if (counts[level]! > 0)
                Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: congestionLevelFor(level).color,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '${counts[level]} ${congestionLevelFor(level).label}',
                      style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

class _JunctionCard extends StatefulWidget {
  final IntersectionSummary intersection;
  const _JunctionCard({required this.intersection});

  @override
  State<_JunctionCard> createState() => _JunctionCardState();
}

class _JunctionCardState extends State<_JunctionCard> {
  final _api = SrmsApi();
  bool _expanded = false;
  List<CameraStatus>? _cameras;
  bool _loadingCameras = false;
  String? _camerasError;

  Future<void> _toggleExpanded() async {
    if (_expanded) {
      setState(() => _expanded = false);
      return;
    }
    setState(() => _expanded = true);
    setState(() => _loadingCameras = true);
    try {
      final data = await _api.getCameras(widget.intersection.id);
      if (!mounted) return;
      setState(() {
        _cameras = data;
        _camerasError = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _camerasError = e.toString());
    } finally {
      if (mounted) setState(() => _loadingCameras = false);
    }
  }

  Future<void> _reportFault(CameraStatus camera) async {
    final controller = TextEditingController();
    final description = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Report fault — ${camera.laneLabel}'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          decoration: const InputDecoration(hintText: 'e.g. feed frozen, no readings since this morning'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Report'),
          ),
        ],
      ),
    );
    if (description == null || description.isEmpty) return;

    try {
      await _api.reportCameraFault(camera.cameraSensorId, description);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Fault reported for ${camera.laneLabel}.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Couldn't report fault: $e")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final intersection = widget.intersection;
    final level = congestionLevelFor(intersection.congestionLevel);
    final hasReading = intersection.congestionLevel != null;

    return Card(
      child: InkWell(
        onTap: _toggleExpanded,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      intersection.name,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text('${intersection.laneCount} lanes', style: const TextStyle(color: Colors.grey)),
                  Icon(_expanded ? Icons.expand_less : Icons.expand_more, color: Colors.grey),
                ],
              ),
              const SizedBox(height: 8),
              if (hasReading)
                Row(
                  children: [
                    Text('${intersection.totalVehicleCount} vehicles', style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: level.color, borderRadius: BorderRadius.circular(999)),
                      child: Text(level.label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                    ),
                  ],
                )
              else
                const Text('Waiting for first camera reading…', style: TextStyle(color: Colors.grey)),
              if (intersection.lastUpdated != null) ...[
                const SizedBox(height: 6),
                Text(
                  'Updated ${_formatTime(intersection.lastUpdated!)} — avg lane density '
                  '${intersection.averageLaneDensityPercent?.toStringAsFixed(0) ?? '-'}%',
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
              if (_expanded) ...[
                const Divider(height: 20),
                _buildRoadBreakdown(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRoadBreakdown() {
    if (_loadingCameras) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Text('Loading road breakdown…', style: TextStyle(color: Colors.grey, fontSize: 12)),
      );
    }
    if (_camerasError != null) {
      return Text(_camerasError!, style: const TextStyle(color: Colors.red, fontSize: 12));
    }
    if (_cameras == null || _cameras!.isEmpty) {
      return const Text('No cameras on this junction yet.', style: TextStyle(color: Colors.grey, fontSize: 12));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Road breakdown', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
        const SizedBox(height: 6),
        ..._cameras!.map((camera) {
          final level = congestionLevelFor(camera.congestionLevel);
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Expanded(child: Text(camera.laneLabel, style: const TextStyle(fontSize: 13))),
                if (camera.vehicleCount != null) ...[
                  Text('${camera.vehicleCount} vehicles', style: const TextStyle(fontSize: 12)),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(color: level.color, borderRadius: BorderRadius.circular(999)),
                    child: Text(level.label, style: const TextStyle(color: Colors.white, fontSize: 11)),
                  ),
                ] else
                  const Text('No reading yet', style: TextStyle(fontSize: 12, color: Colors.grey)),
                IconButton(
                  icon: const Icon(Icons.report_gmailerrorred_outlined, size: 18, color: Colors.orange),
                  tooltip: 'Report fault',
                  visualDensity: VisualDensity.compact,
                  onPressed: () => _reportFault(camera),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  String _formatTime(DateTime utc) {
    final local = utc.toLocal();
    final h = local.hour.toString().padLeft(2, '0');
    final m = local.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}
