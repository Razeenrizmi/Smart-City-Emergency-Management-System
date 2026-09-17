using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRMS.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialEmergencyGreenWave : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "road_junctions",
                columns: table => new
                {
                    junction_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    junction_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    latitude = table.Column<decimal>(type: "numeric(10,8)", nullable: false),
                    longitude = table.Column<decimal>(type: "numeric(11,8)", nullable: false),
                    current_signal_state = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_road_junctions", x => x.junction_id);
                });

            migrationBuilder.CreateTable(
                name: "routes",
                columns: table => new
                {
                    route_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    route_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    start_location = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    destination = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    distance_km = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    estimated_time_minutes = table.Column<int>(type: "integer", nullable: false),
                    traffic_level = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_routes", x => x.route_id);
                });

            migrationBuilder.CreateTable(
                name: "emergency_sessions",
                columns: table => new
                {
                    session_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    driver_id = table.Column<Guid>(type: "uuid", nullable: false),
                    vehicle_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    selected_route_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_emergency_sessions", x => x.session_id);
                    table.ForeignKey(
                        name: "fk_emergency_sessions_selected_route_id",
                        column: x => x.selected_route_id,
                        principalTable: "routes",
                        principalColumn: "route_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "route_junctions",
                columns: table => new
                {
                    route_junction_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    route_id = table.Column<Guid>(type: "uuid", nullable: false),
                    junction_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence_number = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_route_junctions", x => x.route_junction_id);
                    table.ForeignKey(
                        name: "fk_route_junctions_junction_id",
                        column: x => x.junction_id,
                        principalTable: "road_junctions",
                        principalColumn: "junction_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_route_junctions_route_id",
                        column: x => x.route_id,
                        principalTable: "routes",
                        principalColumn: "route_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "signal_preemption_logs",
                columns: table => new
                {
                    log_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    junction_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    activated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deactivated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_signal_preemption_logs", x => x.log_id);
                    table.ForeignKey(
                        name: "fk_signal_preemption_logs_junction_id",
                        column: x => x.junction_id,
                        principalTable: "road_junctions",
                        principalColumn: "junction_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_signal_preemption_logs_session_id",
                        column: x => x.session_id,
                        principalTable: "emergency_sessions",
                        principalColumn: "session_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_emergency_sessions_selected_route_id",
                table: "emergency_sessions",
                column: "selected_route_id");

            migrationBuilder.CreateIndex(
                name: "IX_route_junctions_junction_id",
                table: "route_junctions",
                column: "junction_id");

            migrationBuilder.CreateIndex(
                name: "uq_route_junctions_route_junction",
                table: "route_junctions",
                columns: new[] { "route_id", "junction_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_signal_preemption_logs_junction_id",
                table: "signal_preemption_logs",
                column: "junction_id");

            migrationBuilder.CreateIndex(
                name: "IX_signal_preemption_logs_session_id",
                table: "signal_preemption_logs",
                column: "session_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "route_junctions");

            migrationBuilder.DropTable(
                name: "signal_preemption_logs");

            migrationBuilder.DropTable(
                name: "road_junctions");

            migrationBuilder.DropTable(
                name: "emergency_sessions");

            migrationBuilder.DropTable(
                name: "routes");
        }
    }
}
