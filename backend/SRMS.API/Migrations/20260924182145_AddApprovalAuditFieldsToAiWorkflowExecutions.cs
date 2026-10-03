using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRMS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddApprovalAuditFieldsToAiWorkflowExecutions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "approved_at",
                table: "ai_workflow_executions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "approved_by",
                table: "ai_workflow_executions",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "approval_notes",
                table: "ai_workflow_executions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "approval_notes",
                table: "ai_workflow_executions");

            migrationBuilder.DropColumn(
                name: "approved_by",
                table: "ai_workflow_executions");

            migrationBuilder.DropColumn(
                name: "approved_at",
                table: "ai_workflow_executions");
        }
    }
}
