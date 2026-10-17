using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Kododo.Way.Shell.Tests;

public sealed class ShellAccessTests
{
    private static void MapConfig(WebApplication app, Action<RouteGroupBuilder>? decide = null)
    {
        var group = app.MapWay(ShellApp.Module("config", "Config"), "/config");
        group.MapGet("/api/ping", () => "pong");
        decide?.Invoke(group);
    }

    [Theory]
    [InlineData("/config/")]
    [InlineData("/config/_way/way.js")]
    [InlineData("/config/api/ping")]
    public async Task UndecidedWay_Answers403_OutsideDevelopment(string url)
    {
        await using var app = await ShellApp.StartAsync(a => MapConfig(a));

        var response = await app.GetAsync(url, user: "ada");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("RequireAuthorization", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task UndecidedWay_Works_InDevelopment()
    {
        await using var app = await ShellApp.StartAsync(a => MapConfig(a), environment: "Development");

        Assert.Equal(HttpStatusCode.OK, (await app.GetAsync("/config/")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await app.GetAsync("/config/api/ping")).StatusCode);
    }

    [Fact]
    public async Task UndecidedWay_Works_WithShellAllowAnonymous()
    {
        await using var app = await ShellApp.StartAsync(a => MapConfig(a), shell: o => o.AllowAnonymous = true);

        Assert.Equal(HttpStatusCode.OK, (await app.GetAsync("/config/")).StatusCode);
    }

    [Fact]
    public async Task WayRequiringAuthorization_AsksToSignIn_ThenWorks()
    {
        await using var app = await ShellApp.StartAsync(a => MapConfig(a, g => g.RequireAuthorization("Admin")));

        Assert.Equal(HttpStatusCode.Unauthorized, (await app.GetAsync("/config/")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await app.GetAsync("/config/", user: "ada")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await app.GetAsync("/config/", user: "ada", roles: "Admin")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await app.GetAsync("/config/api/ping", user: "ada", roles: "Admin")).StatusCode);
    }

    [Fact]
    public async Task FallbackPolicy_CountsAsADecision()
    {
        await using var app = await ShellApp.StartAsync(a => MapConfig(a), services: s =>
            s.AddAuthorizationBuilder().SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build()));

        Assert.Equal(HttpStatusCode.Unauthorized, (await app.GetAsync("/config/")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await app.GetAsync("/config/", user: "ada")).StatusCode);
    }

    [Fact]
    public async Task UndecidedWay_IsReportedAtStartup()
    {
        await using var app = await ShellApp.StartAsync(a =>
        {
            MapConfig(a);
            a.MapWay(ShellApp.Module("culture"), "/culture").RequireAuthorization();
        });

        var warning = Assert.Single(app.Logs, l => l.Contains("Way.Shell"));
        Assert.Contains("config", warning);
        Assert.StartsWith("Warning", warning);
    }

    [Fact]
    public async Task NothingIsReported_InDevelopment()
    {
        await using var app = await ShellApp.StartAsync(a => MapConfig(a), environment: "Development");

        Assert.DoesNotContain(app.Logs, l => l.Contains("Way.Shell"));
    }
}

public sealed class ShellPanelTests
{
    /// <summary>config needs Admin, culture any signed-in user, logs nobody decided on, the panel any signed-in user.</summary>
    private static Task<ShellApp> StartPanel(string environment = "Production") => ShellApp.StartAsync(app =>
    {
        app.MapWay(ShellApp.Module("config", "Config"), "/config").RequireAuthorization("Admin");
        app.MapWay(ShellApp.Module("culture", "Culture"), "/culture").RequireAuthorization();
        app.MapWay(ShellApp.Module("logs", "Logs"), "/logs");
        app.MapWay(ShellApp.Module("public", "Public"), "/public").AllowAnonymous();
        app.UseWayShell("/admin").RequireAuthorization();
    }, environment);

    [Fact]
    public async Task Panel_ListsTheWaysTheUserMayOpen()
    {
        await using var app = await StartPanel();

        var editor = ShellApp.SettingsOf(await (await app.GetAsync("/admin/", user: "ada")).Content.ReadAsStringAsync());
        var admin = ShellApp.SettingsOf(await (await app.GetAsync("/admin/", user: "bob", roles: "Admin")).Content.ReadAsStringAsync());

        Assert.Equal("panel", editor.GetProperty("mode").GetString());
        Assert.Equal(JsonValueKind.Null, editor.GetProperty("wayId").ValueKind);
        Assert.Equal(["culture", "public"], ShellApp.WayIds(editor));
        Assert.Equal(["config", "culture", "public"], ShellApp.WayIds(admin));
    }

    [Fact]
    public async Task WayPage_ListsTheOtherWaysTheUserMayOpen_ForLinks()
    {
        await using var app = await StartPanel();

        var editor = ShellApp.SettingsOf(await (await app.GetAsync("/culture/", user: "ada")).Content.ReadAsStringAsync());
        var admin = ShellApp.SettingsOf(await (await app.GetAsync("/culture/", user: "bob", roles: "Admin")).Content.ReadAsStringAsync());

        Assert.Equal("single", editor.GetProperty("mode").GetString());
        Assert.Equal("culture", editor.GetProperty("wayId").GetString());
        Assert.Equal(["culture", "public"], ShellApp.WayIds(editor));
        Assert.Equal(["config", "culture", "public"], ShellApp.WayIds(admin));
    }

    [Fact]
    public async Task Panel_InDevelopment_ListsUndecidedWays()
    {
        await using var app = await StartPanel("Development");

        var settings = ShellApp.SettingsOf(await (await app.GetAsync("/admin/", user: "ada")).Content.ReadAsStringAsync());

        Assert.Equal(["culture", "logs", "public"], ShellApp.WayIds(settings));
    }

    [Fact]
    public async Task Panel_HasItsOwnAuthorization()
    {
        await using var app = await StartPanel();

        Assert.Equal(HttpStatusCode.Unauthorized, (await app.GetAsync("/admin/")).StatusCode);
    }

    [Fact]
    public async Task UndecidedPanel_Answers403_OutsideDevelopment()
    {
        await using var app = await ShellApp.StartAsync(a =>
        {
            a.MapWay(ShellApp.Module("config"), "/config").RequireAuthorization();
            a.UseWayShell("/admin");
        });

        Assert.Equal(HttpStatusCode.Forbidden, (await app.GetAsync("/admin/", user: "ada")).StatusCode);
    }

    [Fact]
    public async Task Panel_PointsModulesAtEachWaysPath()
    {
        await using var app = await StartPanel();

        var settings = ShellApp.SettingsOf(await (await app.GetAsync("/admin/", user: "ada")).Content.ReadAsStringAsync());
        var culture = settings.GetProperty("ways")[0];

        Assert.Equal("Admin", settings.GetProperty("title").GetString());
        Assert.StartsWith("/culture/_way/way.js", culture.GetProperty("moduleUrl").GetString());
        Assert.Equal("/culture/api", culture.GetProperty("apiBase").GetString());
    }
}
