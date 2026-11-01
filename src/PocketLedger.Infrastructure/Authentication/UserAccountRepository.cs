using Microsoft.EntityFrameworkCore;
using Npgsql;
using PocketLedger.Domain.Accounts;
using PocketLedger.Infrastructure.Persistence;

namespace PocketLedger.Infrastructure.Authentication;

internal sealed class UserAccountRepository(ExpensesDbContext context) : IUserAccountRepository
{
    public Task<UserAccount?> FindByEmailAsync(EmailAddress email, CancellationToken cancellationToken) =>
        context.Set<UserAccount>().AsNoTracking().SingleOrDefaultAsync(account => account.Email == email, cancellationToken);

    public async Task<bool> TryAddAsync(UserAccount account, CancellationToken cancellationToken)
    {
        context.Add(account);
        try
        {
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return true;
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
        { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "IX_UserAccounts_Email" })
        {
            context.Entry(account).State = EntityState.Detached;
            return false;
        }
    }
}
