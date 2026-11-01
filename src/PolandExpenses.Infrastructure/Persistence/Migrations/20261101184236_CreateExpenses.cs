using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PolandExpenses.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CreateExpenses : Migration
    {
        private static readonly string[] OwnerDateColumns = ["OwnerId", "PurchaseDate"];
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            ArgumentNullException.ThrowIfNull(migrationBuilder);
            migrationBuilder.CreateTable(
                name: "Expenses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    AmountGrosz = table.Column<long>(type: "bigint", nullable: false),
                    PurchaseDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: true),
                    QualifiesForAllowance = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Expenses", x => x.Id);
                    table.CheckConstraint("CK_Expenses_PositiveAmount", "\"AmountGrosz\" > 0");
                    table.ForeignKey(
                        name: "FK_Expenses_UserAccounts_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "UserAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_OwnerId_PurchaseDate",
                table: "Expenses",
                columns: OwnerDateColumns);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            ArgumentNullException.ThrowIfNull(migrationBuilder);
            migrationBuilder.DropTable(
                name: "Expenses");
        }
    }
}
