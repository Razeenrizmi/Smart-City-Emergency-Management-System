import 'dart:async';

import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../models/cctv_node.dart';
import '../services/cctv_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import 'cctv_detail_screen.dart';
import 'live_camera_screen.dart';

class CctvScreen extends StatefulWidget {
  const CctvScreen({super.key});

  @override
  State<CctvScreen> createState() => _CctvScreenState();
}

class _CctvScreenState extends State<CctvScreen> {
  Timer? _timer;
  List<CctvNode> _nodes = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(AppConfig.pollInterval, (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final nodes = await CctvService.instance.getNodes();
      if (!mounted) return;
      setState(() {
        _nodes = nodes;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('CCTV NODES'),
        actions: [
          IconButton(onPressed: () => _load(), icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _body(),
    );
  }

  Widget _body() {
    if (_loading && _nodes.isEmpty) {
      return const LoadingView(message: 'Loading CCTV nodes...');
    }
    if (_error != null && _nodes.isEmpty) {
      return ErrorView(message: _error!, onRetry: () => _load());
    }
    if (_nodes.isEmpty) {
      return const EmptyView(
        message: 'No CCTV nodes registered on the backend.',
        icon: Icons.videocam_off,
      );
    }

    return RefreshIndicator(
      color: AppPalette.accent,
      onRefresh: () => _load(),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _nodes.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, i) {
          if (i == 0) {
            final online = _nodes.where((n) => n.isOnline).length;
            return Text(
              '${_nodes.length} NODES · $online ONLINE · independent tracking per node',
              style: const TextStyle(color: AppPalette.textMuted, fontSize: 12),
            );
          }
          final node = _nodes[i - 1];
          return _NodeCard(
            node: node,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => CctvDetailScreen(nodeId: node.nodeId)),
            ),
            onLiveCamera: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => LiveCameraScreen(preselectedNodeId: node.nodeId),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _NodeCard extends StatelessWidget {
  final CctvNode node;
  final VoidCallback onTap;
  final VoidCallback onLiveCamera;

  const _NodeCard({
    required this.node,
    required this.onTap,
    required this.onLiveCamera,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          node.nodeLabel,
                          style: const TextStyle(
                            color: AppPalette.accent,
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          node.cameraName.isEmpty ? 'Unnamed camera' : node.cameraName,
                          style: const TextStyle(
                            color: AppPalette.text,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  node.isOnline ? StatusChip.online() : StatusChip.offline(),
                ],
              ),
              const SizedBox(height: 12),
              if (node.location.isNotEmpty)
                Row(
                  children: [
                    const Icon(Icons.place, size: 14, color: AppPalette.textMuted),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        node.location,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: AppPalette.textMuted, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _meta(Icons.smartphone, node.cameraType),
                  _meta(Icons.settings_input_component, node.streamSource),
                  _meta(Icons.schedule, 'Seen ${node.lastSeenAt}'),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(Icons.chevron_right, size: 18, color: AppPalette.textMuted),
                  const Expanded(
                    child: Text(
                      'Open live monitor',
                      style: TextStyle(color: AppPalette.textMuted, fontSize: 12),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton.tonalIcon(
                    onPressed: onLiveCamera,
                    icon: const Icon(Icons.video_camera_front, size: 16),
                    label: const Text('LIVE CAMERA'),
                    style: FilledButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      textStyle: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _meta(IconData icon, String text) {
    if (text.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: AppPalette.surface2,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppPalette.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppPalette.textMuted),
          const SizedBox(width: 5),
          Text(
            text,
            style: const TextStyle(color: AppPalette.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
