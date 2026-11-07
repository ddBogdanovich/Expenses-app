using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PocketLedger.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RetireLocalPasswordVerifiers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            ArgumentNullException.ThrowIfNull(migrationBuilder);
            migrationBuilder.DropIndex(
                name: "IX_UserAccounts_Email",
                table: "UserAccounts");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserAccounts_CredentialKind",
                table: "UserAccounts");

            migrationBuilder.DropColumn(
                name: "PasswordHash",
                table: "UserAccounts");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserAccounts_ExternalIdentityPair",
                table: "UserAccounts",
                sql: "(\"ExternalIssuer\" IS NULL AND \"ExternalSubject\" IS NULL) OR (\"ExternalIssuer\" IS NOT NULL AND \"ExternalSubject\" IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            ArgumentNullException.ThrowIfNull(migrationBuilder);
            // Deleted verifiers cannot be reconstructed. Never invent credentials or erase retained owners.
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    RAISE EXCEPTION 'Password-verifier retirement is irreversible; restore a reviewed pre-cutover backup instead of downgrading.';
                END $$;
                """);
        }
    }
}
