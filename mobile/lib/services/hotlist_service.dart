import '../models/hotlist_vehicle.dart';
import 'api_client.dart';

class HotlistService {
  HotlistService._();

  static final HotlistService instance = HotlistService._();

  Future<List<HotlistVehicle>> getHotlist() async {
    final res = await ApiClient.instance.get<List<HotlistVehicle>>(
      '/crime-vehicle/hotlist',
      decode: (data) => ApiClient.instance.decodeList(
        data,
        (json) => HotlistVehicle.fromJson(json),
      ),
    );
    return res.data ?? <HotlistVehicle>[];
  }

  Future<HotlistVehicle> addVehicle(HotlistVehicle vehicle) async {
    final res = await ApiClient.instance.postJson<HotlistVehicle>(
      '/crime-vehicle/hotlist',
      body: vehicle.toJson(),
      decode: (data) => HotlistVehicle.fromJson(data as Map<String, dynamic>),
    );
    return res.data ?? vehicle;
  }

  Future<HotlistVehicle> updateVehicle(String vehicleId, HotlistVehicle vehicle) async {
    final res = await ApiClient.instance.putJson<HotlistVehicle>(
      '/crime-vehicle/hotlist/$vehicleId',
      body: vehicle.toJson(),
      decode: (data) => HotlistVehicle.fromJson(data as Map<String, dynamic>),
    );
    return res.data ?? vehicle;
  }

  Future<HotlistVehicle> updateStatus(String vehicleId, String status) async {
    final res = await ApiClient.instance.putJson<HotlistVehicle>(
      '/crime-vehicle/hotlist/$vehicleId/status',
      body: {'status': status},
      decode: (data) => HotlistVehicle.fromJson(data as Map<String, dynamic>),
    );
    return res.data ??
        HotlistVehicle(
          plateNumber: '',
          makeModel: '',
          color: '',
          threatLevel: '',
          incidentType: '',
          wantedSince: '',
          lastSeenCamera: '',
          ownerName: '',
        );
  }

  Future<bool> deleteVehicle(String vehicleId) async {
    final res = await ApiClient.instance.deleteJson<bool>(
      '/crime-vehicle/hotlist/$vehicleId',
      decode: (data) => data == true,
    );
    return res.data ?? true;
  }
}
