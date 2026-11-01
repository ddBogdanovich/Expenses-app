using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using PocketLedger.Domain.Expenses;
using PocketLedger.Infrastructure.Expenses;
using PocketLedger.Infrastructure.Persistence;
using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Expenses.Common;

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
        services.AddSingleton<IBusinessCalendar>(provider => new WarsawBusinessCalendar(provider.GetRequiredService<TimeProvider>()));
        return services;
    }
}
