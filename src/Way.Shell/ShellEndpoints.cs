using Kododo.Reiho.AspNetCore.SPA;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Kododo.Way.Shell;

public static class ShellEndpoints
{
    /// <summary>Segment under a Way's path its module files are served from.</summary>
    internal const string ModulePath = "_way";

    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds the shell. Way libraries call this themselves; call it in the app to configure the shell. Safe to call
        /// more than once: every <paramref name="configure"/> applies.
        /// </summary>
        public IServiceCollection AddWayShell(Action<ShellOptions>? configure = null)
        {
            services.TryAddSingleton<WayRegistry>();
            services.AddOptions<ShellOptions>();
            if (configure is not null) services.Configure(configure);
            if (!services.Any(d => d.ImplementationType == typeof(ShellStartupCheck)))
                services.AddHostedService<ShellStartupCheck>();
            return services;
        }
    }

    extension(IEndpointRouteBuilder endpoints)
    {
        /// <summary>
        /// For Way libraries: mounts the shell with only <paramref name="module"/> at <paramref name="path"/>, and the
        /// module's files. The Way maps its API on the returned group, so authorization the host adds to it covers the
        /// page, the module and the API. Outside the Development environment the group answers 403 until the host
        /// decides on its authorization.
        /// </summary>
        public RouteGroupBuilder MapWay(WayModule module, string path)
        {
            ArgumentNullException.ThrowIfNull(module);
            var registry = Registry(endpoints);
            var way = registry.Add(module, Normalize(path));
            MapAssets(endpoints, registry);

            var group = endpoints.MapGroup(way.Path).WithMetadata(new WayEndpointMetadata(module.Id));
            ShellAccess.Protect(group, module.Name);
            group.MapGroup($"/{ModulePath}").MapEmbeddedSpa(module.Assembly, o => o.RootPath = module.ResourceRoot);
            // The other Ways the user may open come along, so the module can link and navigate to them.
            group.MapEmbeddedSpa(typeof(ShellEndpoints).Assembly, o =>
                ShellPage.Configure(o, way.Path, context => VisibleWays(context, registry, way), _ => module.Name, "single", module.Id));
            return group;
        }

        /// <summary>
        /// Mounts the panel at <paramref name="path"/>: one page with every Way mounted in the app that the current
        /// user may open, as decided by the authorization on each Way. Protect the panel itself on the returned group,
        /// e.g. <c>app.UseWayShell("/admin").RequireAuthorization("Admin")</c>.
        /// </summary>
        public RouteGroupBuilder UseWayShell(string path = "/admin")
        {
            var registry = Registry(endpoints);
            MapAssets(endpoints, registry);

            var panelPath = Normalize(path);
            var group = endpoints.MapGroup(panelPath).WithMetadata(new ShellPanelMetadata());
            ShellAccess.Protect(group, "The Way.Shell panel");
            group.MapEmbeddedSpa(typeof(ShellEndpoints).Assembly, o =>
                ShellPage.Configure(o, panelPath, context => VisibleWays(context, registry, current: null), _ => "Admin", "panel", wayId: null));
            return group;
        }
    }

    /// <summary>The Ways the current user may open, in the order they were mounted; <paramref name="current"/> always.</summary>
    private static async Task<IReadOnlyList<RegisteredWay>> VisibleWays(HttpContext context, WayRegistry registry, RegisteredWay? current)
    {
        var visible = new List<RegisteredWay>();
        foreach (var way in registry.Ways)
            if (way == current || await ShellAccess.CanOpen(context, way)) visible.Add(way);
        return visible;
    }

    private static WayRegistry Registry(IEndpointRouteBuilder endpoints) =>
        endpoints.ServiceProvider.GetService<WayRegistry>()
        ?? throw new InvalidOperationException("Way.Shell is not registered. Call services.AddWayShell() (Way libraries do it in their Add… method).");

    /// <summary>The shared libraries and the shell app, once per app and without authorization: they are public files.</summary>
    private static void MapAssets(IEndpointRouteBuilder endpoints, WayRegistry registry)
    {
        lock (registry)
        {
            if (registry.AssetsMapped) return;
            registry.AssetsMapped = true;
        }
        var options = endpoints.ServiceProvider.GetRequiredService<IOptions<ShellOptions>>().Value;
        endpoints.MapGroup(Normalize(options.AssetsPath))
            .AllowAnonymous()
            .MapEmbeddedSpa(typeof(ShellEndpoints).Assembly, o => o.RootPath = ShellPage.AssetsRootPath);
    }

    internal static string Normalize(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        var trimmed = "/" + path.Trim().Trim('/');
        return trimmed == "/" ? throw new ArgumentException("A Way cannot be mounted at the root of the app.", nameof(path)) : trimmed;
    }
}

/// <summary>Warns at startup about every Way or panel that will answer 403 because nobody decided on its authorization.</summary>
internal sealed class ShellStartupCheck(
    IServiceProvider services,
    IHostApplicationLifetime lifetime,
    ILogger<ShellStartupCheck> logger) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        lifetime.ApplicationStarted.Register(Check);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private void Check()
    {
        var endpoints = services.GetService<EndpointDataSource>()?.Endpoints ?? [];
        var undecided = endpoints
            .Where(e => e.Metadata.GetMetadata<WayEndpointMetadata>() is not null || e.Metadata.GetMetadata<ShellPanelMetadata>() is not null)
            .Where(e => !ShellAccess.IsDecided(services, e.Metadata))
            .Select(e => e.Metadata.GetMetadata<WayEndpointMetadata>()?.Id ?? "the panel")
            .Distinct();
        foreach (var name in undecided)
            logger.LogWarning(
                "Way.Shell: {Way} answers 403 because its endpoints neither require authorization nor allow anonymous " +
                "access. Call RequireAuthorization(...) on what Use…Way() or UseWayShell() returns, or set ShellOptions.AllowAnonymous.",
                name);
    }
}
