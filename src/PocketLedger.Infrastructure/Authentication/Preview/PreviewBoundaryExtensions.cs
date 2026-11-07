using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using PocketLedger.UseCases.Authentication.Preview;

namespace PocketLedger.Infrastructure.Authentication.Preview;

/// <summary>Applies cache and transport-failure policies before authentication can short-circuit requests.</summary>
public static class PreviewBoundaryExtensions
{
    /// <summary>Protects authentication and expense responses, including redirects and rejected requests.</summary>
    /// <param name="app">The application pipeline.</param>
    /// <returns>The application pipeline.</returns>
    public static IApplicationBuilder UseAuthenticationBoundary(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        return app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/api/auth", StringComparison.OrdinalIgnoreCase) || context.Request.Path.StartsWithSegments("/api/expenses", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.OnStarting(() =>
                {
                    context.Response.Headers.CacheControl = "no-store, private";
                    context.Response.Headers.Pragma = "no-cache";
                    return Task.CompletedTask;
                });
            }

            try
            {
                await next(context).ConfigureAwait(false);
            }
            catch (Exception exception) when (!context.Response.HasStarted && !context.RequestAborted.IsCancellationRequested &&
                (context.Request.Path == "/api/auth/preview/start" || context.Request.Path == "/api/auth/preview/logout") &&
                PreviewFailureResponse.IsProviderUnavailable(exception))
            {
                // Local logout executes first, so a failed provider request cannot retain local access.
                await PreviewFailureResponse.WriteAsync(context, PreviewFailureResponse.ProviderUnavailable, StatusCodes.Status503ServiceUnavailable).ConfigureAwait(false);
            }
        });
    }
}
