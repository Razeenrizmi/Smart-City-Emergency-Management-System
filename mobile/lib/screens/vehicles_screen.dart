import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../models/hotlist_vehicle.dart';
import '../services/hotlist_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

/// Wanted Vehicles / Criminal Hotlist & Blacklist Database Screen.
/// Interacts directly with ASP.NET backend `/api/crime-vehicle/hotlist`.
class VehiclesScreen extends StatefulWidget {
  const VehiclesScreen({super.key});

  @override
  State<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends State<VehiclesScreen> {
  Timer? _timer;
  List<HotlistVehicle> _items = [];
  bool _loading = true;
  String? _error;

  String _searchQuery = '';
  String _selectedThreat = 'ALL';
  String _selectedStatus = 'ALL';

  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(AppConfig.pollInterval, (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final items = await HotlistService.instance.getHotlist();
      if (!mounted) return;
      setState(() {
        _items = items;
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

  List<HotlistVehicle> get _filteredItems {
    final query = _searchQuery.trim().toLowerCase();
    return _items.where((v) {
      final matchesSearch = query.isEmpty ||
          v.plateNumber.toLowerCase().contains(query) ||
          v.makeModel.toLowerCase().contains(query) ||
          v.incidentType.toLowerCase().contains(query) ||
          v.ownerName.toLowerCase().contains(query);

      final matchesThreat =
          _selectedThreat == 'ALL' || v.threatLevel == _selectedThreat;
      final matchesStatus =
          _selectedStatus == 'ALL' || v.status == _selectedStatus;

      return matchesSearch && matchesThreat && matchesStatus;
    }).toList();
  }

  Future<void> _openRegisterModal([HotlistVehicle? existing]) async {
    final result = await showModalBottomSheet<HotlistVehicle>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _VehicleFormModal(existing: existing, allVehicles: _items),
    );

    if (result != null) {
      _load();
    }
  }

  Future<void> _updateStatus(HotlistVehicle item, String newStatus) async {
    try {
      await HotlistService.instance.updateStatus(
        item.vehicleId.isNotEmpty ? item.vehicleId : '${item.id}',
        newStatus,
      );
      _load(silent: true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Status updated to $newStatus for ${item.plateNumber}'),
            backgroundColor: AppPalette.accent,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update status: $e'),
            backgroundColor: AppPalette.error,
          ),
        );
      }
    }
  }

  Future<void> _confirmDelete(HotlistVehicle item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppPalette.surface,
        title: const Text('Delete Wanted Vehicle', style: TextStyle(color: Colors.white)),
        content: Text(
          'Are you sure you want to remove ${item.plateNumber} (${item.makeModel}) from the wanted hotlist?',
          style: const TextStyle(color: AppPalette.text),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('CANCEL', style: TextStyle(color: AppPalette.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppPalette.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('DELETE', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await HotlistService.instance.deleteVehicle(
          item.vehicleId.isNotEmpty ? item.vehicleId : '${item.id}',
        );
        _load();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Removed ${item.plateNumber} from hotlist'),
              backgroundColor: AppPalette.success,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to delete vehicle: $e'),
              backgroundColor: AppPalette.error,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredItems;

    return Scaffold(
      appBar: AppBar(
        title: const Text('WANTED VEHICLES'),
        actions: [
          IconButton(
            onPressed: () => _openRegisterModal(),
            icon: const Icon(Icons.add_circle_outline, color: AppPalette.accent),
            tooltip: 'Register Wanted Vehicle',
          ),
          IconButton(
            onPressed: () => _load(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppPalette.error,
        onPressed: () => _openRegisterModal(),
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('REGISTER VEHICLE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          // Filter & Search Header
          Container(
            padding: const EdgeInsets.all(12),
            color: AppPalette.surface,
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  onChanged: (v) => setState(() => _searchQuery = v),
                  decoration: InputDecoration(
                    hintText: 'Search plate, make, model, suspect or incident...',
                    hintStyle: const TextStyle(color: AppPalette.textMuted, fontSize: 12),
                    prefixIcon: const Icon(Icons.search, color: AppPalette.textMuted, size: 18),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 16, color: AppPalette.textMuted),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(vertical: 8),
                    filled: true,
                    fillColor: AppPalette.background,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppPalette.border),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _selectedThreat,
                        isExpanded: true,
                        style: const TextStyle(color: Colors.white, fontSize: 11),
                        dropdownColor: AppPalette.surface,
                        decoration: InputDecoration(
                          labelText: 'Severity',
                          labelStyle: const TextStyle(color: AppPalette.textMuted, fontSize: 11),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          filled: true,
                          fillColor: AppPalette.background,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: AppPalette.border),
                          ),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'ALL', child: Text('All Severities')),
                          DropdownMenuItem(value: 'CRITICAL', child: Text('Critical Threat')),
                          DropdownMenuItem(value: 'HIGH', child: Text('High Threat')),
                          DropdownMenuItem(value: 'MEDIUM', child: Text('Medium Threat')),
                        ],
                        onChanged: (v) => setState(() => _selectedThreat = v ?? 'ALL'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _selectedStatus,
                        isExpanded: true,
                        style: const TextStyle(color: Colors.white, fontSize: 11),
                        dropdownColor: AppPalette.surface,
                        decoration: InputDecoration(
                          labelText: 'Status',
                          labelStyle: const TextStyle(color: AppPalette.textMuted, fontSize: 11),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          filled: true,
                          fillColor: AppPalette.background,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: AppPalette.border),
                          ),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'ALL', child: Text('All Statuses')),
                          DropdownMenuItem(value: 'WANTED', child: Text('WANTED')),
                          DropdownMenuItem(value: 'SEARCHING', child: Text('SEARCHING')),
                          DropdownMenuItem(value: 'INTERCEPTED', child: Text('INTERCEPTED')),
                        ],
                        onChanged: (v) => setState(() => _selectedStatus = v ?? 'ALL'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Main List View
          Expanded(
            child: _body(filtered),
          ),
        ],
      ),
    );
  }

  Widget _body(List<HotlistVehicle> filtered) {
    if (_loading && _items.isEmpty) {
      return const LoadingView(message: 'Loading wanted hotlist database...');
    }
    if (_error != null && _items.isEmpty) {
      return ErrorView(message: _error!, onRetry: () => _load());
    }
    if (filtered.isEmpty) {
      return EmptyView(
        message: _items.isEmpty
            ? 'No wanted vehicles registered.\nTap "Register Vehicle" to add a vehicle to the hotlist.'
            : 'No wanted vehicles match your filters.',
        icon: Icons.shield_outlined,
      );
    }

    return RefreshIndicator(
      color: AppPalette.accent,
      onRefresh: () => _load(),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 80),
        itemCount: filtered.length,
        itemBuilder: (context, i) {
          final item = filtered[i];
          return _HotlistVehicleCard(
            item: item,
            onUpdateStatus: (s) => _updateStatus(item, s),
            onEdit: () => _openRegisterModal(item),
            onDelete: () => _confirmDelete(item),
          );
        },
      ),
    );
  }
}

class _HotlistVehicleCard extends StatelessWidget {
  final HotlistVehicle item;
  final ValueChanged<String> onUpdateStatus;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _HotlistVehicleCard({
    required this.item,
    required this.onUpdateStatus,
    required this.onEdit,
    required this.onDelete,
  });

  Color _getThreatColor() {
    switch (item.threatLevel.toUpperCase()) {
      case 'CRITICAL':
        return AppPalette.error;
      case 'HIGH':
        return AppPalette.warning;
      case 'MEDIUM':
        return AppPalette.info;
      default:
        return AppPalette.textMuted;
    }
  }

  Widget _buildImage() {
    if (item.image.isNotEmpty) {
      try {
        if (item.image.startsWith('data:image/')) {
          final comma = item.image.indexOf(',');
          if (comma != -1) {
            final bytes = base64Decode(item.image.substring(comma + 1));
            return Image.memory(
              bytes,
              width: 100,
              height: 85,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => _fallbackImage(),
            );
          }
        } else if (item.image.startsWith('http')) {
          return Image.network(
            item.image,
            width: 100,
            height: 85,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) => _fallbackImage(),
          );
        }
      } catch (_) {}
    }
    return _fallbackImage();
  }

  Widget _fallbackImage() {
    return Container(
      width: 100,
      height: 85,
      decoration: BoxDecoration(
        color: AppPalette.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppPalette.border),
      ),
      child: const Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.directions_car, color: AppPalette.textMuted, size: 28),
          SizedBox(height: 4),
          Text('No Image', style: TextStyle(color: AppPalette.textMuted, fontSize: 9)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final threatColor = _getThreatColor();

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: item.threatLevel == 'CRITICAL'
              ? AppPalette.error.withValues(alpha: 0.6)
              : AppPalette.border,
          width: item.threatLevel == 'CRITICAL' ? 1.5 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: _buildImage(),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.black,
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: AppPalette.warning.withValues(alpha: 0.6)),
                            ),
                            child: Text(
                              item.plateNumber.toUpperCase(),
                              style: const TextStyle(
                                color: AppPalette.warning,
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: threatColor.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: threatColor.withValues(alpha: 0.5)),
                            ),
                            child: Text(
                              '${item.threatLevel} THREAT',
                              style: TextStyle(
                                color: threatColor,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        item.makeModel,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      if (item.color.isNotEmpty)
                        Text(
                          'Color: ${item.color}',
                          style: const TextStyle(color: AppPalette.textMuted, fontSize: 11),
                        ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.warning_amber, size: 13, color: AppPalette.error),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              item.incidentType,
                              style: const TextStyle(
                                color: AppPalette.error,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            const Divider(color: AppPalette.border, height: 1),
            const SizedBox(height: 8),

            // Metadata Grid
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Owner / Suspect', style: TextStyle(color: AppPalette.textMuted, fontSize: 10)),
                      Text(
                        item.ownerName.isEmpty ? 'Unknown' : item.ownerName,
                        style: const TextStyle(color: AppPalette.text, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Last Seen Node', style: TextStyle(color: AppPalette.textMuted, fontSize: 10)),
                      Text(
                        item.lastSeenCamera.isEmpty ? 'Main St & 5th Ave' : item.lastSeenCamera,
                        style: const TextStyle(color: AppPalette.accent, fontSize: 12, fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),

            if (item.notes.isNotEmpty) ...[
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppPalette.surface,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppPalette.border),
                ),
                child: Text(
                  'Notes: ${item.notes}',
                  style: const TextStyle(color: AppPalette.textMuted, fontSize: 11),
                ),
              ),
            ],

            const SizedBox(height: 10),

            // Action Row
            Row(
              children: [
                const Text('Status: ', style: TextStyle(color: AppPalette.textMuted, fontSize: 11)),
                DropdownButton<String>(
                  value: item.status,
                  dropdownColor: AppPalette.surface,
                  underline: const SizedBox(),
                  style: const TextStyle(color: AppPalette.accent, fontSize: 11, fontWeight: FontWeight.bold),
                  items: const [
                    DropdownMenuItem(value: 'WANTED', child: Text('WANTED')),
                    DropdownMenuItem(value: 'SEARCHING', child: Text('SEARCHING')),
                    DropdownMenuItem(value: 'INTERCEPTED', child: Text('INTERCEPTED')),
                  ],
                  onChanged: (v) {
                    if (v != null && v != item.status) {
                      onUpdateStatus(v);
                    }
                  },
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.edit_outlined, size: 18, color: AppPalette.accent),
                  onPressed: onEdit,
                  tooltip: 'Edit Vehicle',
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, size: 18, color: AppPalette.error),
                  onPressed: onDelete,
                  tooltip: 'Delete Vehicle',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Registration & Edit Modal Form
class _VehicleFormModal extends StatefulWidget {
  final HotlistVehicle? existing;
  final List<HotlistVehicle> allVehicles;

  const _VehicleFormModal({this.existing, required this.allVehicles});

  @override
  State<_VehicleFormModal> createState() => _VehicleFormModalState();
}

class _VehicleFormModalState extends State<_VehicleFormModal> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _plateController;
  late TextEditingController _makeModelController;
  late TextEditingController _colorController;
  late TextEditingController _incidentController;
  late TextEditingController _ownerController;
  late TextEditingController _lastSeenController;
  late TextEditingController _notesController;

  String _threatLevel = 'HIGH';
  String _status = 'WANTED';
  String _imageDataUrl = '';
  bool _submitting = false;

  final List<String> _sampleImages = [
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="%231e293b"/><path d="M30 90 L60 50 L140 50 L170 90 Z" fill="%23dc2626"/><circle cx="55" cy="95" r="16" fill="%230f172a" stroke="%2394a3b8" stroke-width="4"/><circle cx="145" cy="95" r="16" fill="%230f172a" stroke="%2394a3b8" stroke-width="4"/><text x="100" y="130" fill="%23f8fafc" font-size="12" text-anchor="middle">WANTED VEHICLE</text></svg>',
  ];

  @override
  void initState() {
    super.initState();
    final v = widget.existing;
    _plateController = TextEditingController(text: v?.plateNumber ?? '');
    _makeModelController = TextEditingController(text: v?.makeModel ?? '');
    _colorController = TextEditingController(text: v?.color ?? '');
    _incidentController = TextEditingController(text: v?.incidentType ?? '');
    _ownerController = TextEditingController(text: v?.ownerName ?? '');
    _lastSeenController = TextEditingController(
      text: v?.lastSeenCamera.isNotEmpty == true ? v!.lastSeenCamera : 'Main St & 5th Ave',
    );
    _notesController = TextEditingController(text: v?.notes ?? '');
    _threatLevel = v?.threatLevel ?? 'HIGH';
    _status = v?.status ?? 'WANTED';
    _imageDataUrl = v?.image ?? _sampleImages.first;
  }

  @override
  void dispose() {
    _plateController.dispose();
    _makeModelController.dispose();
    _colorController.dispose();
    _incidentController.dispose();
    _ownerController.dispose();
    _lastSeenController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  String _normalizePlate(String p) => p.trim().toUpperCase().replaceAll(RegExp(r'\s+'), '');

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final plate = _plateController.text.trim().toUpperCase();
    final isEdit = widget.existing != null;
    final currentId = isEdit ? (widget.existing!.vehicleId.isNotEmpty ? widget.existing!.vehicleId : '${widget.existing!.id}') : '';

    // Check duplicate plate
    final exists = widget.allVehicles.any((v) {
      final vId = v.vehicleId.isNotEmpty ? v.vehicleId : '${v.id}';
      return _normalizePlate(v.plateNumber) == _normalizePlate(plate) && vId != currentId;
    });

    if (exists) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This license plate is already registered on the hotlist!'),
          backgroundColor: AppPalette.error,
        ),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      final payload = HotlistVehicle(
        id: widget.existing?.id ?? 0,
        vehicleId: widget.existing?.vehicleId ?? '',
        plateNumber: plate,
        makeModel: _makeModelController.text.trim(),
        color: _colorController.text.trim(),
        threatLevel: _threatLevel,
        incidentType: _incidentController.text.trim(),
        wantedSince: widget.existing?.wantedSince ?? DateTime.now().toString().split('.').first,
        lastSeenCamera: _lastSeenController.text.trim(),
        ownerName: _ownerController.text.trim(),
        status: _status,
        notes: _notesController.text.trim(),
        image: _imageDataUrl,
      );

      HotlistVehicle saved;
      if (isEdit) {
        saved = await HotlistService.instance.updateVehicle(currentId, payload);
      } else {
        saved = await HotlistService.instance.addVehicle(payload);
      }

      if (mounted) {
        Navigator.of(context).pop(saved);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${isEdit ? 'Updated' : 'Registered'} wanted vehicle ${saved.plateNumber}'),
            backgroundColor: AppPalette.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save vehicle: $e'),
            backgroundColor: AppPalette.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existing != null;

    return Container(
      padding: EdgeInsets.only(
        top: 16,
        left: 16,
        right: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: AppPalette.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    isEdit ? Icons.edit : Icons.shield_outlined,
                    color: isEdit ? AppPalette.accent : AppPalette.error,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isEdit ? 'EDIT WANTED VEHICLE' : 'REGISTER WANTED VEHICLE',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, color: AppPalette.textMuted),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const Divider(color: AppPalette.border),
              const SizedBox(height: 8),

              // License Plate
              TextFormField(
                controller: _plateController,
                style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                decoration: const InputDecoration(
                  labelText: 'License Plate Number *',
                  hintText: 'e.g. WP CAD-7829',
                ),
                textCapitalization: TextCapitalization.characters,
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'License plate is required';
                  if (val.trim().length < 3) return 'Plate must be at least 3 characters';
                  if (val.trim().length > 12) return 'Plate must be at most 12 characters';
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Threat Level Dropdown
              DropdownButtonFormField<String>(
                initialValue: _threatLevel,
                decoration: const InputDecoration(labelText: 'Threat Severity Level *'),
                dropdownColor: AppPalette.surface,
                style: const TextStyle(color: Colors.white),
                items: const [
                  DropdownMenuItem(value: 'CRITICAL', child: Text('CRITICAL (Armed / Violence)')),
                  DropdownMenuItem(value: 'HIGH', child: Text('HIGH (Stolen / Major Crime)')),
                  DropdownMenuItem(value: 'MEDIUM', child: Text('MEDIUM (Traffic Felony)')),
                ],
                onChanged: (v) => setState(() => _threatLevel = v ?? 'HIGH'),
              ),
              const SizedBox(height: 12),

              // Make & Model
              TextFormField(
                controller: _makeModelController,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: 'Vehicle Make & Model *',
                  hintText: 'e.g. Toyota Land Cruiser',
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Vehicle make & model is required';
                  if (val.trim().length < 2) return 'Must be at least 2 characters';
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Color & Incident Row
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _colorController,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                        labelText: 'Vehicle Color *',
                        hintText: 'e.g. Obsidian Black',
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Color is required';
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _ownerController,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                        labelText: 'Owner / Suspect Name *',
                        hintText: 'e.g. Suspect Alias',
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Owner name is required';
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Incident Type
              TextFormField(
                controller: _incidentController,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: 'Incident Type / Reason *',
                  hintText: 'e.g. Armed Robbery, Hit & Run',
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Incident type is required';
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Last Seen Camera
              TextFormField(
                controller: _lastSeenController,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: 'Last Seen Node Location',
                  hintText: 'e.g. Main St & 5th Ave',
                ),
              ),
              const SizedBox(height: 12),

              // Tactical Notes
              TextFormField(
                controller: _notesController,
                style: const TextStyle(color: Colors.white),
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Tactical Notes & Instructions',
                  hintText: 'Armed suspect warnings, special notes...',
                ),
              ),
              const SizedBox(height: 16),

              // Submit Buttons
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isEdit ? AppPalette.accent : AppPalette.error,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          isEdit ? 'SAVE CHANGES' : 'REGISTER & SYNC TO HOTLIST',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
