using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PocketLedger.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AccountFinancialPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            ArgumentNullException.ThrowIfNull(migrationBuilder);
            migrationBuilder.CreateTable(
                name: "AccountPreferences",
                columns: table => new
                {
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    TimeZone = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DefaultCurrency = table.Column<string>(type: "text", nullable: false),
                    RecentCurrencies = table.Column<string[]>(type: "text[]", nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountPreferences", x => x.OwnerId);
                    table.ForeignKey(
                        name: "FK_AccountPreferences_UserAccounts_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "UserAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                INSERT INTO "AccountPreferences" ("OwnerId", "TimeZone", "DefaultCurrency", "RecentCurrencies", "Revision")
                SELECT "Id", 'Europe/Warsaw', 'PLN', ARRAY[]::text[], 0 FROM "UserAccounts";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            ArgumentNullException.ThrowIfNull(migrationBuilder);
            migrationBuilder.DropTable(
                name: "AccountPreferences");
        }
    }
}
