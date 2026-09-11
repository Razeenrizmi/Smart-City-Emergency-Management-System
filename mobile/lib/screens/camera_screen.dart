import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'dart:io';
import '../services/api_service.dart';
import '../models/scan_result.dart';

class CameraScreen extends StatefulWidget {
  final List<CameraDescription> cameras;

  const CameraScreen({super.key, required this.cameras});

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> {
  late CameraController _controller;
  late Future<void> _initializeControllerFuture;
  bool _isScanning = false;
  bool _isRearCamera = true;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  void _initCamera() {
    final camera = _isRearCamera ? widget.cameras.first : widget.cameras.last;
    _controller = CameraController(
      camera,
      ResolutionPreset.high,
      enableAudio: false,
    );
    _initializeControllerFuture = _controller.initialize();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggleCamera() {
    setState(() {
      _isRearCamera = !_isRearCamera;
      _initCamera();
    });
  }

  Future<void> _captureAndScan() async {
    if (_isScanning) return;

    setState(() => _isScanning = true);

    try {
      await _initializeControllerFuture;
      final image = await _controller.takePicture();

      if (!mounted) return;

      // Show scanning overlay
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => const AlertDialog(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Scanning plate...'),
            ],
          ),
        ),
      );

      final result = await ApiService.scanVehicleImage(File(image.path));

      if (!mounted) return;
      Navigator.pop(context); // dismiss loading dialog

      if (result != null) {
        _showResult(result, image.path);
      } else {
        _showError();
      }
    } catch (e) {
      if (mounted) {
        Navigator.of(context).pop();
        _showError();
      }
    } finally {
      setState(() => _isScanning = false);
    }
  }

  void _showError() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Scan Failed'),
        content: const Text('Could not analyze the image. Make sure the backend is running and try again.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _showResult(ScanResult result, String imagePath) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ScanResultScreen(result: result, imagePath: imagePath),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text('ANPR Scanner', style: TextStyle(color: Colors.white)),
        actions: [
          IconButton(
            icon: Icon(
              _isRearCamera ? Icons.camera_rear : Icons.camera_front,
              color: Colors.white,
            ),
            onPressed: _toggleCamera,
          ),
        ],
      ),
      body: Stack(
        children: [
          FutureBuilder(
            future: _initializeControllerFuture,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.done) {
                return CameraPreview(_controller);
              }
              return const Center(child: CircularProgressIndicator());
            },
          ),
          // Scan overlay
          Center(
            child: Container(
              width: MediaQuery.of(context).size.width * 0.8,
              height: 120,
              decoration: BoxDecoration(
                border: Border.all(
                  color: _isScanning ? Colors.orange : Colors.greenAccent,
                  width: 3,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  _isScanning ? 'SCANNING...' : 'Align plate within frame',
                  style: TextStyle(
                    color: _isScanning ? Colors.orange : Colors.greenAccent,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        color: Colors.black,
        padding: const EdgeInsets.all(24),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            // Gallery button (placeholder)
            IconButton(
              icon: const Icon(Icons.photo_library, color: Colors.white, size: 32),
              onPressed: () {
                // TODO: pick from gallery
              },
            ),
            // Capture button
            GestureDetector(
              onTap: _captureAndScan,
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 4),
                ),
                child: Container(
                  margin: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _isScanning ? Colors.orange : Colors.red,
                  ),
                ),
              ),
            ),
            // Flash toggle (placeholder)
            IconButton(
              icon: const Icon(Icons.flash_on, color: Colors.white, size: 32),
              onPressed: () {
                // TODO: toggle flash
              },
            ),
          ],
        ),
      ),
    );
  }
}

class ScanResultScreen extends StatelessWidget {
  final ScanResult result;
  final String imagePath;

  const ScanResultScreen({
    super.key,
    required this.result,
    required this.imagePath,
  });

  Color _threatColor(String level) {
    switch (level.toUpperCase()) {
      case 'CRITICAL':
        return Colors.red;
      case 'HIGH':
        return Colors.orange;
      case 'MEDIUM':
        return Colors.yellow;
      default:
        return Colors.green;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan Result'),
        backgroundColor: result.isMatch ? Colors.red.shade900 : Colors.green.shade900,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Captured image
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.file(
                File(imagePath),
                height: 200,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(height: 16),

            // Status banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: result.isMatch ? Colors.red.shade900 : Colors.green.shade900,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Icon(
                    result.isMatch ? Icons.warning : Icons.check_circle,
                    color: Colors.white,
                    size: 48,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    result.isMatch ? 'HOTLIST MATCH DETECTED' : 'VEHICLE CLEAR',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Plate info
            _buildInfoCard('Detected Plate', result.detectedPlate, Icons.pin),
            _buildInfoCard('Confidence', '${result.confidence.toStringAsFixed(1)}%', Icons.speed),
            _buildInfoCard('Vehicle', result.vehicleInfo, Icons.directions_car),
            _buildInfoCard('Scanned At', result.scannedAt, Icons.access_time),

            // Matched vehicle details
            if (result.isMatch && result.matchedVehicle != null) ...[
              const SizedBox(height: 16),
              const Text(
                'MATCHED VEHICLE DETAILS',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Card(
                color: Colors.red.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildDetailRow('Plate', result.matchedVehicle!.plateNumber),
                      _buildDetailRow('Vehicle', result.matchedVehicle!.makeModel),
                      _buildDetailRow('Color', result.matchedVehicle!.color),
                      _buildDetailRow('Threat Level', result.matchedVehicle!.threatLevel),
                      _buildDetailRow('Incident', result.matchedVehicle!.incidentType),
                      _buildDetailRow('Status', result.matchedVehicle!.status),
                      const SizedBox(height: 8),
                      Text(
                        result.matchedVehicle!.notes,
                        style: TextStyle(color: Colors.grey.shade700, fontStyle: FontStyle.italic),
                      ),
                    ],
                  ),
                ),
              ),
            ],

            const SizedBox(height: 24),

            // Scan again button
            ElevatedButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.camera_alt),
              label: const Text('Scan Another Vehicle'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.deepPurple,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCard(String label, String value, IconData icon) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: Colors.deepPurple),
        title: Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        subtitle: Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text('$label:', style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
