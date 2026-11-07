using Microsoft.Extensions.DependencyInjection;
using PocketLedger.Domain.Accounts;

namespace PocketLedger.Infrastructure.Authentication;

public static class AuthenticationServiceCollectionExtensions
{
    public static IServiceCollection AddAccountAuthentication(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<IUserAccountRepository>(provider => new UserAccountRepository(provider.GetRequiredService<Persistence.ExpensesDbContext>()));
        services.AddAuthorization();
        return services;
    }
}
