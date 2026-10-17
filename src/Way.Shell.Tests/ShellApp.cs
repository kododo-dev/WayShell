using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace Kododo.Way.Shell.Tests;

/// <summary>An app with the shell on a test server. Requests sign in with the X-User and X-Roles headers.</summary>
internal sealed partial class ShellApp : IAsyncDisposable
{
    private readonly WebApplication _app;

    private ShellApp(WebApplication app, HttpClient client, ConcurrentQueue<string> logs)
    {
        _app = app;
        Client = client;
        Logs = logs;
    }

    public HttpClient Client { get; }
    public ConcurrentQueue<string> Logs { get; }

    public static WayModule Module(string id, string name = "Test Way") =>
        new(id, name, typeof(ShellApp).Assembly, "TestWay");

    public static async Task<ShellApp> StartAsync(
        Action<WebApplication> map,
        string environment = "Production",
        Action<ShellOptions>? shell = null,
        Action<IServiceCollection>? services = null,
        string? pathBase = null,
        bool pathBaseInConfiguration = false)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = environment });
        // As ASPNETCORE_PATHBASE puts it there, for apps that pass it on to UsePathBase.
        if (pathBaseInConfiguration) builder.Configuration["PathBase"] = pathBase;
        builder.WebHost.UseTestServer();
        var logs = new ConcurrentQueue<string>();
        builder.Logging.ClearProviders().AddProvider(new QueueLoggerProvider(logs));
        builder.Services.AddAuthentication("Test").AddScheme<AuthenticationSchemeOptions, HeaderAuthentication>("Test", _ => { });
        builder.Services.AddAuthorization(o => o.AddPolicy("Admin", p => p.RequireRole("Admin")));
        builder.Services.AddWayShell(shell);
        services?.Invoke(builder.Services);

        var app = builder.Build();
        if (pathBase is not null)
        {
            app.UsePathBase(pathBase);
            app.UseRouting();
        }
        app.UseAuthentication();
        app.UseAuthorization();
        map(app);
        await app.StartAsync();
        return new ShellApp(app, app.GetTestClient(), logs);
    }

    public Task<HttpResponseMessage> GetAsync(string url, string? user = null, string? roles = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (user is not null) request.Headers.Add("X-User", user);
        if (roles is not null) request.Headers.Add("X-Roles", roles);
        return Client.SendAsync(request);
    }

    /// <summary>The settings the page hands to the shell app.</summary>
    public static JsonElement SettingsOf(string html)
    {
        var json = SettingsScript().Match(html);
        Assert.True(json.Success, "The page has no settings script.");
        return JsonDocument.Parse(json.Groups[1].Value).RootElement;
    }

    public static JsonElement ImportMapOf(string html)
    {
        var json = ImportMapScript().Match(html);
        Assert.True(json.Success, "The page has no import map.");
        return JsonDocument.Parse(json.Groups[1].Value).RootElement.GetProperty("imports");
    }

    public static string[] WayIds(JsonElement settings) =>
        [.. settings.GetProperty("ways").EnumerateArray().Select(w => w.GetProperty("id").GetString()!)];

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await _app.StopAsync();
        await _app.DisposeAsync();
    }

    [GeneratedRegex("""<script type="application/json" id="way-shell-settings">(.*?)</script>""", RegexOptions.Singleline)]
    private static partial Regex SettingsScript();

    [GeneratedRegex("""<script type="importmap"[^>]*>(.*?)</script>""", RegexOptions.Singleline)]
    private static partial Regex ImportMapScript();

    private sealed class HeaderAuthentication(
        IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (Request.Headers["X-User"].ToString() is not { Length: > 0 } user) return Task.FromResult(AuthenticateResult.NoResult());
            var claims = new List<Claim> { new(ClaimTypes.Name, user) };
            claims.AddRange(Request.Headers["X-Roles"].ToString().Split(',', StringSplitOptions.RemoveEmptyEntries).Select(r => new Claim(ClaimTypes.Role, r)));
            var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme.Name));
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name)));
        }
    }

    private sealed class QueueLoggerProvider(ConcurrentQueue<string> logs) : ILoggerProvider
    {
        public ILogger CreateLogger(string categoryName) => new QueueLogger(logs);
        public void Dispose() { }

        private sealed class QueueLogger(ConcurrentQueue<string> logs) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Warning;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            {
                if (IsEnabled(logLevel)) logs.Enqueue($"{logLevel}: {formatter(state, exception)}");
            }
        }
    }
}
