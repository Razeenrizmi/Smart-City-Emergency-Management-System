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
                name: "AiWorkflowExecutions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DomainObjective = table.Column<string>(type: "text", nullable: false),
                    ExecutionPlanJson = table.Column<string>(type: "text", nullable: false),
                    ApprovalStatus = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiWorkflowExecutions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RoadHazardReports",
                columns: table => new
                {
                    HazardId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReportedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Latitude = table.Column<decimal>(type: "numeric", nullable: false),
                    Longitude = table.Column<decimal>(type: "numeric", nullable: false),
                    AccelerometerZSpike = table.Column<decimal>(type: "numeric", nullable: false),
                    ImageUrl = table.Column<string>(type: "text", nullable: true),
                    SeverityScore = table.Column<int>(type: "integer", nullable: false),
                    HazardType = table.Column<string>(type: "text", nullable: false),
                    IsVerified = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoadHazardReports", x => x.HazardId);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AiWorkflowExecutions");

            migrationBuilder.DropTable(
                name: "RoadHazardReports");
        }
    }
}
