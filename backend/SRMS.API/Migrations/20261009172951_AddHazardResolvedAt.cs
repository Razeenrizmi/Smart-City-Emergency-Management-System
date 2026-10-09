using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRMS.API.Migrations.AppDb
{
    /// <inheritdoc />
    public partial class AddHazardResolvedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ResolvedAt",
                table: "RoadHazardReports",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResolvedAt",
                table: "RoadHazardReports");
        }
    }
}
