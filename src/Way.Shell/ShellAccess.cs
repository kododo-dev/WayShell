using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Kododo.Way.Shell;

/// <summary>
/// Who may use a Way: the 403 a Way answers outside Development until the host decides on its authorization, and
/// whether the current user passes the authorization the host put on a Way, for the panel's list.
/// </summary>
internal static class ShellAccess
{
    /// <summary>
    /// Whether the host decided who may use the endpoint: authorization or explicit anonymity on it, a fallback policy,
    /// <see cref="ShellOptions.AllowAnonymous"/>, or the Development environment.
    /// </summary>
    public static bool IsDecided(IServiceProvider services, EndpointMetadataCollection metadata) =>
        HasAuthorizationOrAnonymity(metadata) ||
        services.GetService<IOptions<AuthorizationOptions>>()?.Value.FallbackPolicy is not null ||
        services.GetRequiredService<IOptions<ShellOptions>>().Value.AllowAnonymous ||
        services.GetService<IHostEnvironment>()?.IsDevelopment() == true;

    public static bool HasAuthorizationOrAnonymity(EndpointMetadataCollection metadata) =>
        metadata.GetMetadata<IAuthorizeData>() is not null ||
        metadata.GetMetadata<AuthorizationPolicy>() is not null ||
        metadata.GetMetadata<IAllowAnonymous>() is not null;

    /// <summary>Answers 403 from every endpoint of the group while <see cref="IsDecided"/> is false.</summary>
    public static void Protect(RouteGroupBuilder group, string what)
    {
        // Route handlers (the Way's API) run endpoint filters.
        group.AddEndpointFilter(async (context, next) =>
            IsDecided(context.HttpContext.RequestServices, context.HttpContext.GetEndpoint()?.Metadata ?? EndpointMetadataCollection.Empty)
                ? await next(context)
                : Forbidden(what));

        // Plain request delegates (the shell page, module files) do not; wrap them.
        ((IEndpointConventionBuilder)group).Add(endpoint =>
        {
            if (endpoint.Metadata.Any(m => m is MethodInfo) || endpoint.RequestDelegate is not { } inner) return;
            endpoint.RequestDelegate = async context =>
            {
                if (IsDecided(context.RequestServices, context.GetEndpoint()?.Metadata ?? EndpointMetadataCollection.Empty))
                    await inner(context);
                else
                    await Forbidden(what).ExecuteAsync(context);
            };
        });
    }

    private static IResult Forbidden(string what) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: $"{what} requires authorization",
        detail: "Outside the Development environment, call RequireAuthorization(...) (or AllowAnonymous() for public " +
                "content) on what Use…Way() or UseWayShell() returns, or set ShellOptions.AllowAnonymous.");

    /// <summary>
    /// Whether the current user may open the Way: the authorization the host put on it is evaluated the way the
    /// authorization middleware would, without calling an endpoint.
    /// </summary>
    public static async Task<bool> CanOpen(HttpContext context, RegisteredWay way)
    {
        var services = context.RequestServices;
        var endpoint = services.GetRequiredService<EndpointDataSource>().Endpoints
            .FirstOrDefault(e => e.Metadata.GetMetadata<WayEndpointMetadata>()?.Id == way.Module.Id);
        if (endpoint is null || !IsDecided(services, endpoint.Metadata)) return false;
        if (endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null) return true;

        var policy = await AuthorizationPolicy.CombineAsync(
            services.GetRequiredService<IAuthorizationPolicyProvider>(),
            endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>(),
            endpoint.Metadata.GetOrderedMetadata<AuthorizationPolicy>());
        policy ??= services.GetRequiredService<IOptions<AuthorizationOptions>>().Value.FallbackPolicy;
        if (policy is null) return true;

        var evaluator = services.GetRequiredService<IPolicyEvaluator>();
        var authentication = await evaluator.AuthenticateAsync(policy, context);
        var authorization = await evaluator.AuthorizeAsync(policy, authentication, context, resource: null);
        return authorization.Succeeded;
    }
}
