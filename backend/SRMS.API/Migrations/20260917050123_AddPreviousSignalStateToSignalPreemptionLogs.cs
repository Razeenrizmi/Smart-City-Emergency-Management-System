using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRMS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPreviousSignalStateToSignalPreemptionLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "previous_signal_state",
                table: "signal_preemption_logs",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.UpdateData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111101"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(5788), new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(5789) });

            migrationBuilder.UpdateData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111102"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(5793), new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(5794) });

            migrationBuilder.UpdateData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111103"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(5797), new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(5798) });

            migrationBuilder.UpdateData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111104"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(5801), new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(5801) });

            migrationBuilder.UpdateData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111105"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(5804), new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(5805) });

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333301"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(3861));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333302"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(3864));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333303"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(3867));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333304"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(3869));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333305"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(3871));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333306"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(3873));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333307"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(3875));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333308"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(3878));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333309"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(3880));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333310"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(3882));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333311"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(3884));

            migrationBuilder.UpdateData(
                table: "routes",
                keyColumn: "route_id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222201"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(1207), new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(1208) });

            migrationBuilder.UpdateData(
                table: "routes",
                keyColumn: "route_id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222202"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(1212), new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(1213) });

            migrationBuilder.UpdateData(
                table: "routes",
                keyColumn: "route_id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222203"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(1216), new DateTime(2026, 9, 17, 5, 1, 23, 329, DateTimeKind.Utc).AddTicks(1216) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "previous_signal_state",
                table: "signal_preemption_logs");

            migrationBuilder.UpdateData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111101"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7185), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7185) });

            migrationBuilder.UpdateData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111102"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7193), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7194) });

            migrationBuilder.UpdateData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111103"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7198), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7198) });

            migrationBuilder.UpdateData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111104"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7202), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7203) });

            migrationBuilder.UpdateData(
                table: "road_junctions",
                keyColumn: "junction_id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111105"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7206), new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(7207) });

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333301"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3749));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333302"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3753));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333303"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3757));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333304"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3760));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333305"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3763));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333306"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3766));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333307"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3769));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333308"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3773));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333309"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3776));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333310"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3779));

            migrationBuilder.UpdateData(
                table: "route_junctions",
                keyColumn: "route_junction_id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333311"),
                column: "created_at",
                value: new DateTime(2026, 9, 17, 4, 32, 20, 50, DateTimeKind.Utc).AddTicks(3782));

            migrationBuilder.UpdateData(
                table: "routes",
                keyColumn: "route_id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222201"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 4, 32, 20, 49, DateTimeKind.Utc).AddTicks(8771), new DateTime(2026, 9, 17, 4, 32, 20, 49, DateTimeKind.Utc).AddTicks(8772) });

            migrationBuilder.UpdateData(
                table: "routes",
                keyColumn: "route_id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222202"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 4, 32, 20, 49, DateTimeKind.Utc).AddTicks(8778), new DateTime(2026, 9, 17, 4, 32, 20, 49, DateTimeKind.Utc).AddTicks(8778) });

            migrationBuilder.UpdateData(
                table: "routes",
                keyColumn: "route_id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222203"),
                columns: new[] { "created_at", "updated_at" },
                values: new object[] { new DateTime(2026, 9, 17, 4, 32, 20, 49, DateTimeKind.Utc).AddTicks(8783), new DateTime(2026, 9, 17, 4, 32, 20, 49, DateTimeKind.Utc).AddTicks(8784) });
        }
    }
}
