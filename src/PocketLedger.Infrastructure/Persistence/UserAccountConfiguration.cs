using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PocketLedger.Domain.Accounts;

namespace PocketLedger.Infrastructure.Persistence;

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
        builder.HasIndex(account => account.Email).IsUnique().HasFilter("\"PasswordHash\" IS NOT NULL");
        builder.OwnsOne(account => account.ExternalIdentity, identity =>
        {
            identity.Property(value => value.Issuer).HasColumnName("ExternalIssuer").HasMaxLength(ExternalIdentity.MaximumIssuerLength).IsRequired();
            identity.Property(value => value.Subject).HasColumnName("ExternalSubject").HasMaxLength(ExternalIdentity.MaximumSubjectLength).IsRequired();
            identity.HasIndex(value => new { value.Issuer, value.Subject }).IsUnique().HasDatabaseName("IX_UserAccounts_ExternalIdentity");
        });
        builder.ToTable(table => table.HasCheckConstraint("CK_UserAccounts_CredentialKind",
            "(\"PasswordHash\" IS NOT NULL AND \"ExternalIssuer\" IS NULL AND \"ExternalSubject\" IS NULL) OR " +
            "(\"PasswordHash\" IS NULL AND \"ExternalIssuer\" IS NOT NULL AND \"ExternalSubject\" IS NOT NULL)"));
        builder.Property(account => account.PasswordHash).HasMaxLength(PasswordHashMaximumLength);
    }

    private static EmailAddress ParseEmail(string value) => EmailAddress.TryCreate(value, out var email)
        ? email
        : throw new InvalidOperationException("Stored account email violates the domain invariant.");
}
