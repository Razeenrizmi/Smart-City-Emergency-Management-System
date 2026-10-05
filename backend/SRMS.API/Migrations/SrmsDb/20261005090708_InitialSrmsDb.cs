using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRMS.API.Migrations.SrmsDb
{
    /// <inheritdoc />
    public partial class InitialSrmsDb : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "congestion");

            migrationBuilder.CreateTable(
                name: "Intersections",
                schema: "congestion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    LaneCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Intersections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                schema: "congestion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    FullName = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AgentWorkflowRuns",
                schema: "congestion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IntersectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Objective = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    FinalOutcome = table.Column<string>(type: "text", nullable: true),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentWorkflowRuns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentWorkflowRuns_Intersections_IntersectionId",
                        column: x => x.IntersectionId,
                        principalSchema: "congestion",
                        principalTable: "Intersections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CameraSensors",
                schema: "congestion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IntersectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    LaneLabel = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    InstalledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CameraSensors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CameraSensors_Intersections_IntersectionId",
                        column: x => x.IntersectionId,
                        principalSchema: "congestion",
                        principalTable: "Intersections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AgentWorkflowSteps",
                schema: "congestion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkflowRunId = table.Column<Guid>(type: "uuid", nullable: false),
                    AgentName = table.Column<string>(type: "text", nullable: false),
                    StepIndex = table.Column<int>(type: "integer", nullable: false),
                    InputJson = table.Column<string>(type: "text", nullable: true),
                    OutputJson = table.Column<string>(type: "text", nullable: true),
                    ToolCallsJson = table.Column<string>(type: "text", nullable: true),
                    ValidationResult = table.Column<string>(type: "text", nullable: true),
                    DurationMs = table.Column<int>(type: "integer", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentWorkflowSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentWorkflowSteps_AgentWorkflowRuns_WorkflowRunId",
                        column: x => x.WorkflowRunId,
                        principalSchema: "congestion",
                        principalTable: "AgentWorkflowRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SignalTimingProposals",
                schema: "congestion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkflowRunId = table.Column<Guid>(type: "uuid", nullable: false),
                    IntersectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProposedPlanJson = table.Column<string>(type: "text", nullable: false),
                    Justification = table.Column<string>(type: "text", nullable: false),
                    SafetyCheckStatus = table.Column<string>(type: "text", nullable: false),
                    SafetyCheckNotes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignalTimingProposals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SignalTimingProposals_AgentWorkflowRuns_WorkflowRunId",
                        column: x => x.WorkflowRunId,
                        principalSchema: "congestion",
                        principalTable: "AgentWorkflowRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SignalTimingProposals_Intersections_IntersectionId",
                        column: x => x.IntersectionId,
                        principalSchema: "congestion",
                        principalTable: "Intersections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SensorFaultReports",
                schema: "congestion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CameraSensorId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReportedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    PhotoUrl = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ReportedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SensorFaultReports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SensorFaultReports_CameraSensors_CameraSensorId",
                        column: x => x.CameraSensorId,
                        principalSchema: "congestion",
                        principalTable: "CameraSensors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SensorFaultReports_Users_ReportedByUserId",
                        column: x => x.ReportedByUserId,
                        principalSchema: "congestion",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TelemetryReadings",
                schema: "congestion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CameraSensorId = table.Column<Guid>(type: "uuid", nullable: false),
                    IntersectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VehicleCount = table.Column<int>(type: "integer", nullable: false),
                    QueueLength = table.Column<int>(type: "integer", nullable: false),
                    LaneDensityPercent = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TelemetryReadings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TelemetryReadings_CameraSensors_CameraSensorId",
                        column: x => x.CameraSensorId,
                        principalSchema: "congestion",
                        principalTable: "CameraSensors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TelemetryReadings_Intersections_IntersectionId",
                        column: x => x.IntersectionId,
                        principalSchema: "congestion",
                        principalTable: "Intersections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SignalTimingDecisions",
                schema: "congestion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProposalId = table.Column<Guid>(type: "uuid", nullable: false),
                    DecidedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Decision = table.Column<string>(type: "text", nullable: false),
                    Comment = table.Column<string>(type: "text", nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignalTimingDecisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SignalTimingDecisions_SignalTimingProposals_ProposalId",
                        column: x => x.ProposalId,
                        principalSchema: "congestion",
                        principalTable: "SignalTimingProposals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SignalTimingDecisions_Users_DecidedByUserId",
                        column: x => x.DecidedByUserId,
                        principalSchema: "congestion",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgentWorkflowRuns_IntersectionId",
                schema: "congestion",
                table: "AgentWorkflowRuns",
                column: "IntersectionId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentWorkflowRuns_Status",
                schema: "congestion",
                table: "AgentWorkflowRuns",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_AgentWorkflowSteps_WorkflowRunId",
                schema: "congestion",
                table: "AgentWorkflowSteps",
                column: "WorkflowRunId");

            migrationBuilder.CreateIndex(
                name: "IX_CameraSensors_IntersectionId_LaneLabel",
                schema: "congestion",
                table: "CameraSensors",
                columns: new[] { "IntersectionId", "LaneLabel" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SensorFaultReports_CameraSensorId",
                schema: "congestion",
                table: "SensorFaultReports",
                column: "CameraSensorId");

            migrationBuilder.CreateIndex(
                name: "IX_SensorFaultReports_ReportedByUserId",
                schema: "congestion",
                table: "SensorFaultReports",
                column: "ReportedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_SignalTimingDecisions_DecidedByUserId",
                schema: "congestion",
                table: "SignalTimingDecisions",
                column: "DecidedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_SignalTimingDecisions_ProposalId",
                schema: "congestion",
                table: "SignalTimingDecisions",
                column: "ProposalId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SignalTimingProposals_IntersectionId",
                schema: "congestion",
                table: "SignalTimingProposals",
                column: "IntersectionId");

            migrationBuilder.CreateIndex(
                name: "IX_SignalTimingProposals_WorkflowRunId",
                schema: "congestion",
                table: "SignalTimingProposals",
                column: "WorkflowRunId");

            migrationBuilder.CreateIndex(
                name: "IX_TelemetryReadings_CameraSensorId",
                schema: "congestion",
                table: "TelemetryReadings",
                column: "CameraSensorId");

            migrationBuilder.CreateIndex(
                name: "IX_TelemetryReadings_IntersectionId_Timestamp",
                schema: "congestion",
                table: "TelemetryReadings",
                columns: new[] { "IntersectionId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                schema: "congestion",
                table: "Users",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AgentWorkflowSteps",
                schema: "congestion");

            migrationBuilder.DropTable(
                name: "SensorFaultReports",
                schema: "congestion");

            migrationBuilder.DropTable(
                name: "SignalTimingDecisions",
                schema: "congestion");

            migrationBuilder.DropTable(
                name: "TelemetryReadings",
                schema: "congestion");

            migrationBuilder.DropTable(
                name: "SignalTimingProposals",
                schema: "congestion");

            migrationBuilder.DropTable(
                name: "Users",
                schema: "congestion");

            migrationBuilder.DropTable(
                name: "CameraSensors",
                schema: "congestion");

            migrationBuilder.DropTable(
                name: "AgentWorkflowRuns",
                schema: "congestion");

            migrationBuilder.DropTable(
                name: "Intersections",
                schema: "congestion");
        }
    }
}
