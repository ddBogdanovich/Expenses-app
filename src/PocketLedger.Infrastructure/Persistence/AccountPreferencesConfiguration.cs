using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PocketLedger.Domain.Accounts;
using PocketLedger.Domain.Preferences;

namespace PocketLedger.Infrastructure.Persistence;

internal sealed class AccountPreferencesConfiguration : IEntityTypeConfiguration<AccountPreferences>
{
    public void Configure(EntityTypeBuilder<AccountPreferences> builder)
    {
        builder.ToTable("AccountPreferences");
        builder.HasKey(value => value.OwnerId);
        builder.HasOne<UserAccount>().WithOne().HasForeignKey<AccountPreferences>(value => value.OwnerId).OnDelete(DeleteBehavior.Cascade);
        builder.Property(value => value.TimeZone).HasMaxLength(AccountPreferences.MaximumTimeZoneLength).IsRequired();
        builder.Property(value => value.DefaultCurrency).IsRequired();
        builder.Property(value => value.RecentCurrencies).HasColumnType("text[]").IsRequired();
        builder.Property(value => value.Revision).IsConcurrencyToken();
    }
}
