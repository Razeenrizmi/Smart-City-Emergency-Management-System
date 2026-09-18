using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRMS.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_workflow_executions",
                columns: table => new
                {
                    workflow_id = table.Column<Guid>(type: "uuid", nullable: false),
                    domain_objective = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    execution_plan = table.Column<string>(type: "jsonb", nullable: false),
                    approval_status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_workflow_executions", x => x.workflow_id);
                });

            migrationBuilder.CreateTable(
                name: "road_junctions",
                columns: table => new
                {
                    junction_id = table.Column<Guid>(type: "uuid", nullable: false),
                    junction_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    latitude = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: false),
                    longitude = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: false),
                    current_signal_state = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_road_junctions", x => x.junction_id);
                });

            migrationBuilder.CreateTable(
                name: "junction_camera_telemetry",
                columns: table => new
                {
                    telemetry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    junction_id = table.Column<Guid>(type: "uuid", nullable: false),
                    camera_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    detected_vehicle_count = table.Column<int>(type: "integer", nullable: false),
                    congestion_level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    recorded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_junction_camera_telemetry", x => x.telemetry_id);
                    table.ForeignKey(
                        name: "FK_junction_camera_telemetry_road_junctions_junction_id",
                        column: x => x.junction_id,
                        principalTable: "road_junctions",
                        principalColumn: "junction_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "signal_adjustment_proposals",
                columns: table => new
                {
                    proposal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    junction_id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_id = table.Column<Guid>(type: "uuid", nullable: true),
                    proposed_green_extension_sec = table.Column<int>(type: "integer", nullable: false),
                    is_approved_by_operator = table.Column<bool>(type: "boolean", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_signal_adjustment_proposals", x => x.proposal_id);
                    table.ForeignKey(
                        name: "FK_signal_adjustment_proposals_road_junctions_junction_id",
                        column: x => x.junction_id,
                        principalTable: "road_junctions",
                        principalColumn: "junction_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_junction_camera_telemetry_junction_id_recorded_at",
                table: "junction_camera_telemetry",
                columns: new[] { "junction_id", "recorded_at" });

            migrationBuilder.CreateIndex(
                name: "IX_signal_adjustment_proposals_junction_id_is_approved_by_oper~",
                table: "signal_adjustment_proposals",
                columns: new[] { "junction_id", "is_approved_by_operator" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_workflow_executions");

            migrationBuilder.DropTable(
                name: "junction_camera_telemetry");

            migrationBuilder.DropTable(
                name: "signal_adjustment_proposals");

            migrationBuilder.DropTable(
                name: "road_junctions");
        }
    }
}
