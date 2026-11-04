using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PocketLedger.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ExternalAccountsAndBrowserSessions : Migration
    {
        private static readonly string[] ExternalIdentityColumns = ["ExternalIssuer", "ExternalSubject"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            ArgumentNullException.ThrowIfNull(migrationBuilder);
            migrationBuilder.DropIndex(
                name: "IX_UserAccounts_Email",
                table: "UserAccounts");

            migrationBuilder.AlterColumn<string>(
                name: "PasswordHash",
                table: "UserAccounts",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1024)",
                oldMaxLength: 1024);

            migrationBuilder.AddColumn<string>(
                name: "ExternalIssuer",
                table: "UserAccounts",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalSubject",
                table: "UserAccounts",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BrowserSessions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    ProtectedTicket = table.Column<byte[]>(type: "bytea", nullable: false),
                    ExpiresUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BrowserSessions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserAccounts_Email",
                table: "UserAccounts",
                column: "Email",
                unique: true,
                filter: "\"PasswordHash\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_UserAccounts_ExternalIdentity",
                table: "UserAccounts",
                columns: ExternalIdentityColumns,
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserAccounts_CredentialKind",
                table: "UserAccounts",
                sql: "(\"PasswordHash\" IS NOT NULL AND \"ExternalIssuer\" IS NULL AND \"ExternalSubject\" IS NULL) OR (\"PasswordHash\" IS NULL AND \"ExternalIssuer\" IS NOT NULL AND \"ExternalSubject\" IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_BrowserSessions_ExpiresUtc",
                table: "BrowserSessions",
                column: "ExpiresUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            ArgumentNullException.ThrowIfNull(migrationBuilder);
            // Downgrade cannot erase an external identity or invent a legacy password verifier.
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM "UserAccounts" WHERE "ExternalIssuer" IS NOT NULL) THEN
                        RAISE EXCEPTION 'External accounts exist; downgrade requires an explicitly reviewed data migration.';
                    END IF;
                END $$;
                """);
            migrationBuilder.DropTable(
                name: "BrowserSessions");

            migrationBuilder.DropIndex(
                name: "IX_UserAccounts_Email",
                table: "UserAccounts");

            migrationBuilder.DropIndex(
                name: "IX_UserAccounts_ExternalIdentity",
                table: "UserAccounts");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserAccounts_CredentialKind",
                table: "UserAccounts");

            migrationBuilder.DropColumn(
                name: "ExternalIssuer",
                table: "UserAccounts");

            migrationBuilder.DropColumn(
                name: "ExternalSubject",
                table: "UserAccounts");

            migrationBuilder.AlterColumn<string>(
                name: "PasswordHash",
                table: "UserAccounts",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(1024)",
                oldMaxLength: 1024,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserAccounts_Email",
                table: "UserAccounts",
                column: "Email",
                unique: true);
        }
    }
}
