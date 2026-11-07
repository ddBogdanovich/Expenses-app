using Microsoft.AspNetCore.Http;

namespace PocketLedger.Infrastructure.Authentication.Preview;

/// <summary>Writes bounded protocol failures without provider messages or authentication material.</summary>
internal static class PreviewFailureResponse
{
    internal const string CallbackFailed = "auth.callback_failed";
    internal const string TransactionExpired = "auth.transaction_expired";
    internal const string Cancelled = "auth.cancelled";
    internal const string ProviderUnavailable = "auth.provider_unavailable";

    internal static Task WriteAsync(HttpContext context, string code, int status)
    {
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
