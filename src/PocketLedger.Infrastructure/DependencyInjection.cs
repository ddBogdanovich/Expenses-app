using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using PocketLedger.Domain.Expenses;
using PocketLedger.Domain.Preferences;
using PocketLedger.Infrastructure.Expenses;
using PocketLedger.Infrastructure.Persistence;
using PocketLedger.Infrastructure.Preferences;
using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Expenses.Common;
using PocketLedger.UseCases.Preferences.Common;

namespace PocketLedger.Infrastructure;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentAccount>(provider => new CurrentAccount(provider.GetRequiredService<IHttpContextAccessor>()));
        services.AddScoped<IExpenseRepository>(provider => new ExpenseRepository(provider.GetRequiredService<ExpensesDbContext>()));
        services.AddScoped<IExpenseQueries>(provider => new ExpenseQueries(provider.GetRequiredService<ExpensesDbContext>()));
        services.AddSingleton<IBusinessCalendar>(_ => new RegionalBusinessCalendar());
        services.AddSingleton<IBusinessClock>(provider => new BusinessClock(provider.GetRequiredService<TimeProvider>()));
        services.AddSingleton<ITimeZoneCatalogue>(_ => new TimeZoneCatalogue());
        services.AddScoped<IAccountPreferencesRepository>(provider => new AccountPreferencesRepository(provider.GetRequiredService<ExpensesDbContext>()));
        services.AddScoped<IAccountContextReader>(provider => new AccountContextReader(
            provider.GetRequiredService<IAccountPreferencesRepository>(), provider.GetRequiredService<IBusinessCalendar>(),
            provider.GetRequiredService<IBusinessClock>(), provider.GetRequiredService<ITimeZoneCatalogue>()));
        return services;
    }
}
