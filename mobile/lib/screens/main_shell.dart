import 'package:flutter/material.dart';

import 'alerts_screen.dart';
import 'cctv_screen.dart';
import 'home_screen.dart';
import 'live_camera_screen.dart';
import 'map_screen.dart';
import 'vehicles_screen.dart';

/// Unified bottom navigation shell.
///
/// The first tab is the shared [HomeScreen] hub (Emergency Green Wave,
/// road-hazard detection and crime-vehicle shortcuts); the remaining tabs are
/// the crime vehicle surveillance tools.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  static const _screens = [
    HomeScreen(),
    CctvScreen(),
    LiveCameraScreen(),
    VehiclesScreen(),
    AlertsScreen(),
    MapScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.videocam_outlined),
            selectedIcon: Icon(Icons.videocam),
            label: 'CCTV',
          ),
          NavigationDestination(
            icon: Icon(Icons.video_camera_front_outlined),
            selectedIcon: Icon(Icons.video_camera_front),
            label: 'Camera',
          ),
          NavigationDestination(
            icon: Icon(Icons.shield_outlined),
            selectedIcon: Icon(Icons.shield),
            label: 'Wanted',
          ),
          NavigationDestination(
            icon: Icon(Icons.warning_amber_outlined),
            selectedIcon: Icon(Icons.warning_amber),
            label: 'Alerts',
          ),
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map),
            label: 'Map',
          ),
        ],
      ),
    );
  }
}
