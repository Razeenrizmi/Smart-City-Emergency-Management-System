using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SRMS.API.Migrations.AppDb
{
    /// <inheritdoc />
    public partial class AddCrimeVehicleDetection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Cameras",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CameraId = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Zone = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Lat = table.Column<double>(type: "double precision", nullable: false),
                    Lng = table.Column<double>(type: "double precision", nullable: false),
                    Resolution = table.Column<string>(type: "text", nullable: false),
                    Fps = table.Column<int>(type: "integer", nullable: false),
                    ScannedToday = table.Column<int>(type: "integer", nullable: false),
                    LastPlate = table.Column<string>(type: "text", nullable: false),
                    LastScanTime = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cameras", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CctvNodes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    NodeId = table.Column<int>(type: "integer", nullable: false),
                    CameraName = table.Column<string>(type: "text", nullable: false),
                    Location = table.Column<string>(type: "text", nullable: false),
                    CameraType = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    StreamSource = table.Column<string>(type: "text", nullable: false),
                    StreamUrl = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<string>(type: "text", nullable: false),
                    LastSeenAt = table.Column<string>(type: "text", nullable: false),
                    Lat = table.Column<double>(type: "double precision", nullable: true),
                    Lng = table.Column<double>(type: "double precision", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CctvNodes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DetectionLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LogId = table.Column<string>(type: "text", nullable: false),
                    Timestamp = table.Column<string>(type: "text", nullable: false),
                    PlateNumber = table.Column<string>(type: "text", nullable: false),
                    CameraId = table.Column<string>(type: "text", nullable: false),
                    CameraName = table.Column<string>(type: "text", nullable: false),
                    Location = table.Column<string>(type: "text", nullable: false),
                    Confidence = table.Column<double>(type: "double precision", nullable: false),
                    Speed = table.Column<string>(type: "text", nullable: false),
                    Direction = table.Column<string>(type: "text", nullable: false),
                    IsHotlistMatch = table.Column<bool>(type: "boolean", nullable: false),
                    ThreatLevel = table.Column<string>(type: "text", nullable: false),
                    VehicleDetails = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Snapshot = table.Column<string>(type: "text", nullable: false),
                    NodeId = table.Column<int>(type: "integer", nullable: false),
                    SessionId = table.Column<string>(type: "text", nullable: false),
                    TrackId = table.Column<int>(type: "integer", nullable: true),
                    VehicleType = table.Column<string>(type: "text", nullable: false),
                    VehicleConfidence = table.Column<double>(type: "double precision", nullable: false),
                    OcrConfidence = table.Column<double>(type: "double precision", nullable: false),
                    CrimeMatch = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DetectionLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DetectionSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SessionId = table.Column<string>(type: "text", nullable: false),
                    NodeId = table.Column<int>(type: "integer", nullable: false),
                    StartedAt = table.Column<string>(type: "text", nullable: false),
                    EndedAt = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DetectionSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PatrolUnits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UnitId = table.Column<string>(type: "text", nullable: false),
                    Callsign = table.Column<string>(type: "text", nullable: false),
                    LeadOfficer = table.Column<string>(type: "text", nullable: false),
                    Sector = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    VehicleType = table.Column<string>(type: "text", nullable: false),
                    DistanceToAlert = table.Column<string>(type: "text", nullable: false),
                    Eta = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PatrolUnits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "vehicle",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    VehicleId = table.Column<string>(type: "text", nullable: false),
                    PlateNumber = table.Column<string>(type: "text", nullable: false),
                    MakeModel = table.Column<string>(type: "text", nullable: false),
                    Color = table.Column<string>(type: "text", nullable: false),
                    ThreatLevel = table.Column<string>(type: "text", nullable: false),
                    IncidentType = table.Column<string>(type: "text", nullable: false),
                    WantedSince = table.Column<string>(type: "text", nullable: false),
                    LastSeenCamera = table.Column<string>(type: "text", nullable: false),
                    OwnerName = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    Image = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vehicle", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "Cameras",
                columns: new[] { "Id", "CameraId", "Fps", "LastPlate", "LastScanTime", "Lat", "Lng", "Name", "Resolution", "ScannedToday", "Status", "Zone" },
                values: new object[] { 1, "CAM-101", 60, "", "Never", 6.9271000000000003, 79.861199999999997, "Main St & 5th Ave Intersection", "4K HDR ANPR", 0, "Active", "Downtown Central" });

            migrationBuilder.InsertData(
                table: "CctvNodes",
                columns: new[] { "Id", "CameraName", "CameraType", "CreatedAt", "LastSeenAt", "Lat", "Lng", "Location", "NodeId", "Status", "StreamSource", "StreamUrl" },
                values: new object[,]
                {
                    { 1, "Main Street CCTV", "LAPTOP_WEBCAM", "2026-01-01 00:00:00", "Never", 6.9271000000000003, 79.861199999999997, "Main St & 5th Ave (University Simulated Node)", 1, "OFFLINE", "LOCAL_WEBCAM", "" },
                    { 2, "University Gate CCTV", "MOBILE_CAMERA", "2026-01-01 00:00:00", "Never", 6.9175000000000004, 79.882999999999996, "University Main Gate (University Simulated Node)", 2, "OFFLINE", "PHONE_CAMERA", "" }
                });

            migrationBuilder.InsertData(
                table: "PatrolUnits",
                columns: new[] { "Id", "Callsign", "DistanceToAlert", "Eta", "LeadOfficer", "Sector", "Status", "UnitId", "VehicleType" },
                values: new object[,]
                {
                    { 1, "Patrol Alpha 4", "1.2 km", "2 mins", "Sgt. Miller & Off. Davis", "Downtown Central", "AVAILABLE", "UNIT-402", "High-Speed Interceptor Utility" },
                    { 2, "Tactical Bravo 2", "2.8 km", "4 mins", "Capt. Reynolds (SWAT)", "Financial District", "AVAILABLE", "UNIT-308", "Armored Tactical Response Unit" },
                    { 3, "Highway Patrol Delta 9", "4.5 km", "6 mins", "Off. Chen", "Western Highway Corridor", "AVAILABLE", "UNIT-512", "Dodge Pursuit Cruiser" },
                    { 4, "Air Surveillance Recon 1", "0.8 km", "1 min", "Pilot Vance", "City-Wide Aerial", "ON_PATROL", "UNIT-105", "Eurocopter Emergency Drone/Chopper" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Cameras_CameraId",
                table: "Cameras",
                column: "CameraId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CctvNodes_NodeId",
                table: "CctvNodes",
                column: "NodeId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DetectionLogs_LogId",
                table: "DetectionLogs",
                column: "LogId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DetectionLogs_NodeId_SessionId_TrackId",
                table: "DetectionLogs",
                columns: new[] { "NodeId", "SessionId", "TrackId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DetectionSessions_SessionId",
                table: "DetectionSessions",
                column: "SessionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PatrolUnits_UnitId",
                table: "PatrolUnits",
                column: "UnitId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_VehicleId",
                table: "vehicle",
                column: "VehicleId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Cameras");

            migrationBuilder.DropTable(
                name: "CctvNodes");

            migrationBuilder.DropTable(
                name: "DetectionLogs");

            migrationBuilder.DropTable(
                name: "DetectionSessions");

            migrationBuilder.DropTable(
                name: "PatrolUnits");

            migrationBuilder.DropTable(
                name: "vehicle");
        }
    }
}
