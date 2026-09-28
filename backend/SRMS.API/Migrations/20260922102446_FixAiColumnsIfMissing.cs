using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRMS.API.Migrations
{
    /// <inheritdoc />
    public partial class FixAiColumnsIfMissing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE \"RoadHazardReports\" ADD COLUMN IF NOT EXISTS \"AiAnalysisSummary\" text;");
            migrationBuilder.Sql("ALTER TABLE \"RoadHazardReports\" ADD COLUMN IF NOT EXISTS \"AiConfidenceScore\" double precision NOT NULL DEFAULT 0.0;");
            migrationBuilder.Sql("ALTER TABLE \"RoadHazardReports\" ADD COLUMN IF NOT EXISTS \"AiDetectedCategory\" text;");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE \"RoadHazardReports\" DROP COLUMN IF EXISTS \"AiAnalysisSummary\";");
            migrationBuilder.Sql("ALTER TABLE \"RoadHazardReports\" DROP COLUMN IF EXISTS \"AiConfidenceScore\";");
            migrationBuilder.Sql("ALTER TABLE \"RoadHazardReports\" DROP COLUMN IF EXISTS \"AiDetectedCategory\";");

        }
    }
}
