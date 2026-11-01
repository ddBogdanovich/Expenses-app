using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PolandExpenses.Domain.Accounts;

namespace PolandExpenses.Infrastructure.Persistence;

internal sealed class UserAccountConfiguration : IEntityTypeConfiguration<UserAccount>
{
    private const int PasswordHashMaximumLength = 1024;

    public void Configure(EntityTypeBuilder<UserAccount> builder)
    {
        builder.ToTable("UserAccounts");
        builder.HasKey(account => account.Id);
        builder.Property(account => account.Email).HasConversion(
            email => email.Value,
            value => ParseEmail(value)).HasMaxLength(EmailAddress.MaximumLength).IsRequired();
        builder.HasIndex(account => account.Email).IsUnique();
        builder.Property(account => account.PasswordHash).HasMaxLength(PasswordHashMaximumLength).IsRequired();
    }

    private static EmailAddress ParseEmail(string value) => EmailAddress.TryCreate(value, out var email)
        ? email
        : throw new InvalidOperationException("Stored account email violates the domain invariant.");
}
