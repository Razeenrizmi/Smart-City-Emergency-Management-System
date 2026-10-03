import 'package:flutter/material.dart';

// Mirrors web/src/lib/congestion.js so the color/label an inspector sees
// on mobile matches what the web Junction Control Panel shows.
class CongestionLevel {
  final String label;
  final Color color;
  const CongestionLevel(this.label, this.color);
}

const Map<String, CongestionLevel> congestionLevels = {
  'LOW': CongestionLevel('Low', Color(0xFF22C55E)),
  'MODERATE': CongestionLevel('Moderate', Color(0xFFEAB308)),
  'HIGH': CongestionLevel('High', Color(0xFFF97316)),
  'SEVERE': CongestionLevel('Severe', Color(0xFFEF4444)),
};

CongestionLevel congestionLevelFor(String? level) =>
    congestionLevels[level] ?? congestionLevels['LOW']!;

// Higher = more severe. Used to sort junctions worst-first and to build
// the summary header's counts. A junction with no reading yet sorts last.
const Map<String?, int> congestionSeverityRank = {
  'SEVERE': 4,
  'HIGH': 3,
  'MODERATE': 2,
  'LOW': 1,
  null: 0,
};
