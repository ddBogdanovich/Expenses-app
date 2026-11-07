namespace PocketLedger.Infrastructure.Authentication.Preview;

/// <summary>Classifies provider server failures before protocol parsing, without retaining response bodies.</summary>
internal sealed class PreviewProviderHandler(HttpMessageHandler innerHandler) : DelegatingHandler(innerHandler)
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var response = await base.SendAsync(request, cancellationToken).ConfigureAwait(false);
        if ((int)response.StatusCode >= Microsoft.AspNetCore.Http.StatusCodes.Status500InternalServerError)
        {
            var status = response.StatusCode;
            response.Dispose();
            throw new HttpRequestException("The identity provider is unavailable.", null, status);
        }

        return response;
    }
}
