using System.Reflection;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using PolandExpenses.UseCases.Common;

namespace PolandExpenses.UseCases;

public static class UseCasesServiceCollectionExtensions
{
    public static IServiceCollection AddUseCases(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        var concreteTypes = Assembly.GetExecutingAssembly()
            .DefinedTypes
            .Where(type => !type.IsAbstract && !type.IsInterface)
            .ToArray();

        foreach (var handlerType in concreteTypes.Where(IsUseCaseHandler))
        {
            services.AddScoped(handlerType.AsType());
        }

        foreach (var endpointType in concreteTypes.Where(typeof(IEndpoint).IsAssignableFrom))
        {
            services.AddSingleton(typeof(IEndpoint), endpointType.AsType());
        }

        return services;
    }

    public static IEndpointRouteBuilder MapUseCaseEndpoints(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        foreach (var endpoint in endpoints.ServiceProvider.GetServices<IEndpoint>())
        {
            endpoint.MapEndpoint(endpoints);
        }

        return endpoints;
    }

    private static bool IsUseCaseHandler(TypeInfo type) => type.ImplementedInterfaces.Any(
        contract => contract.IsGenericType &&
            contract.GetGenericTypeDefinition() == typeof(IUseCaseHandler<,>));
}
