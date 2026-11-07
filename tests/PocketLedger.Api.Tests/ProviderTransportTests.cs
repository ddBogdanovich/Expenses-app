using System.Net;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PocketLedger.UseCases.Authentication.Preview;

namespace PocketLedger.Api.Tests;

public sealed class ProviderTransportTests(AuthenticationDatabase database) : IClassFixture<AuthenticationDatabase>
{
    [Theory]
    [InlineData(400)]
    [InlineData(503)]
    public async Task ProviderBackchannelClassifiesServerFailureBeforeReadingProtocolBodyAsync(int status)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        await using var provider = builder.Build();
        provider.MapGet("/provider", () => Results.Text("sensitive-provider-description", statusCode: status));
        await provider.StartAsync();
        try
        {
            using var application = database.CreateApplication();
            var backchannel = application.Services.GetRequiredService<IOptionsMonitor<OpenIdConnectOptions>>().Get(PreviewAuthentication.OidcScheme).Backchannel;
            var url = new Uri(provider.Urls.Single() + "/provider");
            if (status == 503)
            {
                var exception = await Assert.ThrowsAsync<HttpRequestException>(() => backchannel.GetAsync(url));
                Assert.Equal(HttpStatusCode.ServiceUnavailable, exception.StatusCode);
                Assert.DoesNotContain("sensitive-provider-description", exception.Message, StringComparison.Ordinal);
            }
            else
            {
                using var response = await backchannel.GetAsync(url);
                Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
                Assert.Equal("sensitive-provider-description", await response.Content.ReadAsStringAsync());
            }
        }
        finally
        {
            await provider.StopAsync();
        }
    }
}
