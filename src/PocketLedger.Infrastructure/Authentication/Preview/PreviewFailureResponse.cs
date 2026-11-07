using Microsoft.AspNetCore.Http;

namespace PocketLedger.Infrastructure.Authentication.Preview;

/// <summary>Writes bounded protocol failures without provider messages or authentication material.</summary>
internal static class PreviewFailureResponse
{
    internal const string CallbackFailed = "auth.callback_failed";
    internal const string TransactionExpired = "auth.transaction_expired";
    internal const string Cancelled = "auth.cancelled";
    internal const string ProviderUnavailable = "auth.provider_unavailable";

    internal static Task WriteAsync(HttpContext context, string code, int status, string? destination = null)
    {
        // Only browser document requests receive presentation navigation. API
        // clients retain the Phase 4 status/JSON contract, including 401 handling.
        if (context.Request.GetTypedHeaders().Accept?.Any(value => value.MediaType.Equals("text/html", StringComparison.OrdinalIgnoreCase) && value.Quality != 0) == true)
        {
            context.Response.Headers.CacheControl = "no-store";
            // Preserve only the exact approved reference destination, never raw
            // callback query/state or an arbitrary browser-provided return URL.
            destination ??= context.Request.Query["returnUrl"].ToString();
            var continuation = destination == "/design-system" ? "&returnUrl=%2Fdesign-system" : string.Empty;
            var browserCode = context.Request.Path == "/api/auth/preview/logout" ? "auth.logout_incomplete" : code;
            context.Response.Redirect("/auth/recovery?code=" + Uri.EscapeDataString(browserCode) + continuation);
            return Task.CompletedTask;
        }

        context.Response.StatusCode = status;
        context.Response.Headers.CacheControl = "no-store";
        return context.Response.WriteAsJsonAsync(new { code, status, title = "Authentication could not be completed. Start a new sign-in attempt." }, context.RequestAborted);
    }

    internal static bool IsProviderUnavailable(Exception? exception)
    {
        // Metadata retrieval wraps transport failures; never classify arbitrary application failures as outages.
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is HttpRequestException or IOException or TaskCanceledException)
            {
                return true;
            }
        }

        return false;
    }
}
