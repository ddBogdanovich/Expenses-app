using System.Reflection;
using Microsoft.Extensions.DependencyInjection;
using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases;

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

        services.AddControllers().AddApplicationPart(Assembly.GetExecutingAssembly());
        return services;
    }

    private static bool IsUseCaseHandler(TypeInfo type) => type.ImplementedInterfaces.Any(
        contract => contract.IsGenericType &&
            contract.GetGenericTypeDefinition() == typeof(IUseCaseHandler<,>));
}
