using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRMS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAiWorkflowExecutions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_workflow_executions",
                columns: table => new
                {
                    workflow_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    thread_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    proposal_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    objective = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    current_stage = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    completed_steps = table.Column<string>(type: "jsonb", nullable: true),
                    workflow_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    proposal_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    approval_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    is_valid = table.Column<bool>(type: "boolean", nullable: false),
                    handoff_ready = table.Column<bool>(type: "boolean", nullable: false),
                    validation_notes = table.Column<string>(type: "jsonb", nullable: true),
                    proposed_actions = table.Column<string>(type: "jsonb", nullable: true),
                    error_summary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_workflow_executions", x => x.workflow_id);
                    table.ForeignKey(
                        name: "fk_ai_workflow_executions_session_id",
                        column: x => x.session_id,
                        principalTable: "emergency_sessions",
                        principalColumn: "session_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "uq_ai_workflow_executions_session_id",
                table: "ai_workflow_executions",
                column: "session_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_workflow_executions");
        }
    }
}
