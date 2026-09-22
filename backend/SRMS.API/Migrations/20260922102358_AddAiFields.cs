using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRMS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAiFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AiAnalysisSummary",
                table: "RoadHazardReports",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "AiConfidenceScore",
                table: "RoadHazardReports",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "AiDetectedCategory",
                table: "RoadHazardReports",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "ConfidenceScore",
                table: "AiWorkflowExecutions",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DetectedCategory",
                table: "AiWorkflowExecutions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "HazardReportId",
                table: "AiWorkflowExecutions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InputPayload",
                table: "AiWorkflowExecutions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OutputPayload",
                table: "AiWorkflowExecutions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ProcessingMs",
                table: "AiWorkflowExecutions",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<bool>(
                name: "WasAutoVerified",
                table: "AiWorkflowExecutions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "WorkflowType",
                table: "AiWorkflowExecutions",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiAnalysisSummary",
                table: "RoadHazardReports");

            migrationBuilder.DropColumn(
                name: "AiConfidenceScore",
                table: "RoadHazardReports");

            migrationBuilder.DropColumn(
                name: "AiDetectedCategory",
                table: "RoadHazardReports");

            migrationBuilder.DropColumn(
                name: "ConfidenceScore",
                table: "AiWorkflowExecutions");

            migrationBuilder.DropColumn(
                name: "DetectedCategory",
                table: "AiWorkflowExecutions");

            migrationBuilder.DropColumn(
                name: "HazardReportId",
                table: "AiWorkflowExecutions");

            migrationBuilder.DropColumn(
                name: "InputPayload",
                table: "AiWorkflowExecutions");

            migrationBuilder.DropColumn(
                name: "OutputPayload",
                table: "AiWorkflowExecutions");

            migrationBuilder.DropColumn(
                name: "ProcessingMs",
                table: "AiWorkflowExecutions");

            migrationBuilder.DropColumn(
                name: "WasAutoVerified",
                table: "AiWorkflowExecutions");

            migrationBuilder.DropColumn(
                name: "WorkflowType",
                table: "AiWorkflowExecutions");
        }
    }
}
