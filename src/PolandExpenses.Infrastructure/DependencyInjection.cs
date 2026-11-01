using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using PolandExpenses.Domain.Expenses;
using PolandExpenses.Infrastructure.Expenses;
using PolandExpenses.Infrastructure.Persistence;
using PolandExpenses.UseCases.Common;
using PolandExpenses.UseCases.Expenses.Common;

namespace PolandExpenses.Infrastructure;

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
