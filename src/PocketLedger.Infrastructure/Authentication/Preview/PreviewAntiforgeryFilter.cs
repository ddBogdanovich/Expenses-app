using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using PocketLedger.UseCases.Authentication.Preview;

namespace PocketLedger.Infrastructure.Authentication.Preview;

internal sealed class PreviewAntiforgeryFilter(IAntiforgery antiforgery) : IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var request = context.HttpContext.Request;
        var isLogout = context.ActionDescriptor is ControllerActionDescriptor action &&
            action.ControllerTypeInfo.AsType() == typeof(PreviewLogoutController);
        if (context.HttpContext.User.Identity?.AuthenticationType != PreviewAuthentication.CookieScheme && !isLogout ||
            HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method) || HttpMethods.IsOptions(request.Method))
        {
            return;
        }

        try
        {
            await antiforgery.ValidateRequestAsync(context.HttpContext).ConfigureAwait(false);
        }
        catch (AntiforgeryValidationException)
        {
            context.Result = new BadRequestObjectResult(new ProblemDetails { Status = StatusCodes.Status400BadRequest, Title = "The request could not be verified." });
        }
    }
}
