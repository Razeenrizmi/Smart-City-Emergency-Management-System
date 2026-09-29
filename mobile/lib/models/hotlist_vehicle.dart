class HotlistVehicle {
  final int id;
  final String vehicleId;
  final String plateNumber;
  final String makeModel;
  final String color;
  final String threatLevel;
  final String incidentType;
  final String wantedSince;
  final String lastSeenCamera;
  final String ownerName;
  final String status;
  final String notes;
  final String image;

  const HotlistVehicle({
    this.id = 0,
    this.vehicleId = '',
    required this.plateNumber,
    required this.makeModel,
    required this.color,
    required this.threatLevel,
    required this.incidentType,
    required this.wantedSince,
    required this.lastSeenCamera,
    required this.ownerName,
    this.status = 'WANTED',
    this.notes = '',
    this.image = '',
  });

  factory HotlistVehicle.fromJson(Map<String, dynamic> json) {
    return HotlistVehicle(
      id: (json['id'] as num?)?.toInt() ?? 0,
      vehicleId: json['vehicleId'] as String? ?? '',
      plateNumber: json['plateNumber'] as String? ?? '',
      makeModel: json['makeModel'] as String? ?? '',
      color: json['color'] as String? ?? '',
      threatLevel: json['threatLevel'] as String? ?? 'HIGH',
      incidentType: json['incidentType'] as String? ?? '',
      wantedSince: json['wantedSince'] as String? ?? '',
      lastSeenCamera: json['lastSeenCamera'] as String? ?? '',
      ownerName: json['ownerName'] as String? ?? '',
      status: json['status'] as String? ?? 'WANTED',
      notes: json['notes'] as String? ?? '',
      image: json['image'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id > 0) 'id': id,
      if (vehicleId.isNotEmpty) 'vehicleId': vehicleId,
      'plateNumber': plateNumber,
      'makeModel': makeModel,
      'color': color,
      'threatLevel': threatLevel,
      'incidentType': incidentType,
      'wantedSince': wantedSince,
      'lastSeenCamera': lastSeenCamera,
      'ownerName': ownerName,
      'status': status,
      'notes': notes,
      'image': image,
    };
  }
}
