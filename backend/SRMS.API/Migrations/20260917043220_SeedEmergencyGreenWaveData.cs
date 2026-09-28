using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SRMS.API.Migrations
{
    /// <inheritdoc />
    public partial class SeedEmergencyGreenWaveData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "road_junctions",
                columns: new[] { "junction_id", "created_at", "current_signal_state", "junction_name", "latitude", "longitude", "updated_at" },
                values: new object[,]
                {
                    { new Guid("11111111-1111-1111-1111-111111111101"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7185), "RED", "Peradeniya Junction", 7.2580m, 80.5710m, new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7185) },
                    { new Guid("11111111-1111-1111-1111-111111111102"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7193), "RED", "Gatambe Junction", 7.2650m, 80.5780m, new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7194) },
                    { new Guid("11111111-1111-1111-1111-111111111103"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7198), "GREEN", "Hospital Junction", 7.2720m, 80.5850m, new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7198) },
                    { new Guid("11111111-1111-1111-1111-111111111104"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7202), "RED", "Town Junction", 7.2790m, 80.5920m, new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7203) },
                    { new Guid("11111111-1111-1111-1111-111111111105"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7206), "RED", "Lake Junction", 7.2860m, 80.5990m, new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7207) }
                });

            migrationBuilder.InsertData(
                table: "routes",
                columns: new[] { "route_id", "created_at", "destination", "distance_km", "estimated_time_minutes", "route_name", "start_location", "traffic_level", "updated_at" },
                values: new object[,]
                {
                    { new Guid("22222222-2222-2222-2222-222222222201"), new DateTime(2026, 9, 17, 4, 32, 20, 49, DateTimeKind.Utc).AddTicks(8771), "Kandy", 5.00m, 15, "Route A", "Peradeniya", "HIGH", new DateTime(2026, 9, 17, 4, 32, 20, 49, DateTimeKind.Utc).AddTicks(8772) },
                    { new Guid("22222222-2222-2222-2222-222222222202"), new DateTime(2026, 9, 17, 4, 32, 20, 49, DateTimeKind.Utc).AddTicks(8778), "Kandy", 6.00m, 8, "Route B", "Peradeniya", "LOW", new DateTime(2026, 9, 17, 4, 32, 20, 49, DateTimeKind.Utc).AddTicks(8778) },
                    { new Guid("22222222-2222-2222-2222-222222222203"), new DateTime(2026, 9, 17, 4, 32, 20, 49, DateTimeKind.Utc).AddTicks(8783), "Kandy", 7.00m, 11, "Route C", "Peradeniya", "MEDIUM", new DateTime(2026, 9, 17, 4, 32, 20, 49, DateTimeKind.Utc).AddTicks(8784) }
                });

            migrationBuilder.InsertData(
                table: "route_junctions",
                columns: new[] { "route_junction_id", "created_at", "junction_id", "route_id", "sequence_number" },
                values: new object[,]
                {
                    { new Guid("33333333-3333-3333-3333-333333333301"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3749), new Guid("11111111-1111-1111-1111-111111111101"), new Guid("22222222-2222-2222-2222-222222222201"), 1 },
                    { new Guid("33333333-3333-3333-3333-333333333302"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3753), new Guid("11111111-1111-1111-1111-111111111102"), new Guid("22222222-2222-2222-2222-222222222201"), 2 },
                    { new Guid("33333333-3333-3333-3333-333333333303"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3757), new Guid("11111111-1111-1111-1111-111111111104"), new Guid("22222222-2222-2222-2222-222222222201"), 3 },
                    { new Guid("33333333-3333-3333-3333-333333333304"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3760), new Guid("11111111-1111-1111-1111-111111111105"), new Guid("22222222-2222-2222-2222-222222222201"), 4 },
                    { new Guid("33333333-3333-3333-3333-333333333305"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3763), new Guid("11111111-1111-1111-1111-111111111101"), new Guid("22222222-2222-2222-2222-222222222202"), 1 },
                    { new Guid("33333333-3333-3333-3333-333333333306"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3766), new Guid("11111111-1111-1111-1111-111111111102"), new Guid("22222222-2222-2222-2222-222222222202"), 2 },
                    { new Guid("33333333-3333-3333-3333-333333333307"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3769), new Guid("11111111-1111-1111-1111-111111111103"), new Guid("22222222-2222-2222-2222-222222222202"), 3 },
                    { new Guid("33333333-3333-3333-3333-333333333308"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3773), new Guid("11111111-1111-1111-1111-111111111101"), new Guid("22222222-2222-2222-2222-222222222203"), 1 },
                    { new Guid("33333333-3333-3333-3333-333333333309"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3776), new Guid("11111111-1111-1111-1111-111111111103"), new Guid("22222222-2222-2222-2222-222222222203"), 2 },
                    { new Guid("33333333-3333-3333-3333-333333333310"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3779), new Guid("11111111-1111-1111-1111-111111111104"), new Guid("22222222-2222-2222-2222-222222222203"), 3 },
                    { new Guid("33333333-3333-3333-3333-333333333311"), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3782), new Guid("11111111-1111-1111-1111-111111111105"), new Guid("22222222-2222-2222-2222-222222222203"), 4 }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333301"));

            migrationBuilder.DeleteData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333302"));

            migrationBuilder.DeleteData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333303"));

            migrationBuilder.DeleteData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333304"));

            migrationBuilder.DeleteData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333305"));

            migrationBuilder.DeleteData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333306"));

            migrationBuilder.DeleteData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333307"));

            migrationBuilder.DeleteData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333308"));

            migrationBuilder.DeleteData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333309"));

            migrationBuilder.DeleteData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333310"));

            migrationBuilder.DeleteData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333311"));

            migrationBuilder.DeleteData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111101"));

            migrationBuilder.DeleteData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111102"));

            migrationBuilder.DeleteData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111103"));

            migrationBuilder.DeleteData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111104"));

            migrationBuilder.DeleteData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111105"));

            migrationBuilder.DeleteData(
                table: "routes",
                keyColumn: "route_id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222201"));

            migrationBuilder.DeleteData(
                table: "routes",
                keyColumn: "route_id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222202"));

            migrationBuilder.DeleteData(
                table: "routes",
                keyColumn: "route_id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222203"));
        }
    }
}
