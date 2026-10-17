using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Kododo.Way.Shell.Tests;

public sealed class ShellPageTests
{
    private static Task<ShellApp> StartWithWay(
        Action<ShellOptions>? shell = null, string? pathBase = null, bool pathBaseInConfiguration = false, string? strippedPathBase = null) =>
        ShellApp.StartAsync(app => app.MapWay(ShellApp.Module("config", "Config"), "/config").AllowAnonymous(),
            shell: shell, pathBase: pathBase, pathBaseInConfiguration: pathBaseInConfiguration, strippedPathBase: strippedPathBase);

    [Fact]
    public async Task WayPage_PutsTheShellTogether()
    {
        await using var app = await StartWithWay();

        var response = await app.GetAsync("/config/");
        var html = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Contains("""<base href="/config/">""", html);
        Assert.Contains("<title>Config</title>", html);
        Assert.Matches("""<script type="module" src="/_way-shell/assets/shell-[^"]+\.js"></script>""", html);
        Assert.Contains("""<link rel="modulepreload" href="/_way-shell/assets/""", html);
    }

    [Fact]
    public async Task ImportMap_MapsEverySharedLibrary_ToTheSharedAssets()
    {
        await using var app = await StartWithWay();

        var imports = ShellApp.ImportMapOf(await (await app.GetAsync("/config/")).Content.ReadAsStringAsync());

        foreach (var library in new[] { "react", "react-dom", "react-dom/client", "react/jsx-runtime", "@emotion/react",
                     "@emotion/styled", "@mui/material", "@mui/system", "react-router-dom", "@kododo-dev/way-shell" })
            Assert.StartsWith("/_way-shell/assets/", imports.GetProperty(library).GetString());
    }

    [Fact]
    public async Task Settings_DescribeTheWayAndItsModule()
    {
        await using var app = await StartWithWay();

        var settings = ShellApp.SettingsOf(await (await app.GetAsync("/config")).Content.ReadAsStringAsync());
        var way = Assert.Single(settings.GetProperty("ways").EnumerateArray());

        Assert.Equal("single", settings.GetProperty("mode").GetString());
        Assert.Equal("config", settings.GetProperty("wayId").GetString());
        Assert.Equal("Config", settings.GetProperty("title").GetString());
        Assert.Equal("config", way.GetProperty("id").GetString());
        Assert.Equal("/config/", way.GetProperty("url").GetString());
        Assert.Equal("/config/api", way.GetProperty("apiBase").GetString());
        Assert.Matches("^/config/_way/way.js\\?v=[0-9a-f]{12}$", way.GetProperty("moduleUrl").GetString());
        Assert.Matches("^/config/_way/way.css\\?v=[0-9a-f]{12}$", way.GetProperty("cssUrl").GetString());
    }

    [Fact]
    public async Task Settings_CarryTheHostOptions()
    {
        await using var app = await StartWithWay(o =>
        {
            o.Title = "My <app>";
            o.HomeUrl = "/";
            o.Language = "pl";
            o.Links.Add(new ShellLink("Docs", "/docs") { Icon = "home" });
            o.User = _ => new ShellUser("Ada") { AccountUrl = "/account", SignOutUrl = "/logout" };
        });

        var html = await (await app.GetAsync("/config/")).Content.ReadAsStringAsync();
        var settings = ShellApp.SettingsOf(html);

        Assert.Contains("<title>My &lt;app&gt;</title>", html);
        Assert.Contains("""<html lang="pl">""", html);
        Assert.Equal("My <app>", settings.GetProperty("title").GetString());
        Assert.Equal("/", settings.GetProperty("homeUrl").GetString());
        Assert.Equal("Docs", settings.GetProperty("links")[0].GetProperty("title").GetString());
        Assert.Equal("home", settings.GetProperty("links")[0].GetProperty("icon").GetString());
        Assert.Equal("/account", settings.GetProperty("user").GetProperty("accountUrl").GetString());
        Assert.Equal("Ada", settings.GetProperty("user").GetProperty("name").GetString());
        Assert.Equal("/logout", settings.GetProperty("user").GetProperty("signOutUrl").GetString());
    }

    [Fact]
    public async Task Settings_CannotCloseTheirScriptElement()
    {
        await using var app = await StartWithWay(o => o.Title = "</script><script>alert(1)</script>");

        var html = await (await app.GetAsync("/config/")).Content.ReadAsStringAsync();

        Assert.DoesNotContain("</script><script>alert(1)", html);
        Assert.Equal("</script><script>alert(1)</script>", ShellApp.SettingsOf(html).GetProperty("title").GetString());
    }

    [Fact]
    public async Task Nonce_IsPutOnTheInlineImportMapAndScripts()
    {
        await using var app = await StartWithWay(o => o.Nonce = _ => "n0nce");

        var html = await (await app.GetAsync("/config/")).Content.ReadAsStringAsync();

        Assert.Contains("""<script type="importmap" nonce="n0nce">""", html);
        Assert.Contains("""<script type="module" nonce="n0nce" src=""", html);
    }

    [Fact]
    public async Task PathBase_IsInEveryUrl()
    {
        await using var app = await StartWithWay(pathBase: "/p");

        var html = await (await app.GetAsync("/p/config/")).Content.ReadAsStringAsync();
        var way = ShellApp.SettingsOf(html).GetProperty("ways")[0];

        Assert.Contains("""<base href="/p/config/">""", html);
        Assert.StartsWith("/p/_way-shell/assets/", ShellApp.ImportMapOf(html).GetProperty("react").GetString());
        Assert.StartsWith("/p/config/_way/way.js", way.GetProperty("moduleUrl").GetString());
        Assert.Equal("/p/config/api", way.GetProperty("apiBase").GetString());
    }

    [Fact]
    public async Task PathBase_FromConfiguration_PassedToUsePathBase_IsNotDoubled()
    {
        await using var app = await StartWithWay(pathBase: "/p", pathBaseInConfiguration: true);

        var html = await (await app.GetAsync("/p/config/")).Content.ReadAsStringAsync();

        Assert.Contains("""<base href="/p/config/">""", html);
    }

    [Fact]
    public async Task PathBase_StrippedByAProxy_ComesFromConfiguration()
    {
        // As behind a reverse proxy that serves the app at /demo and removes the prefix, with ASPNETCORE_PATHBASE=/demo.
        await using var app = await StartWithWay(o => o.Links.Add(new ShellLink("Home", "~/")), strippedPathBase: "/demo/");

        var html = await (await app.GetAsync("/config/")).Content.ReadAsStringAsync();
        var settings = ShellApp.SettingsOf(html);
        var way = settings.GetProperty("ways")[0];

        Assert.Contains("""<base href="/demo/config/">""", html);
        Assert.StartsWith("/demo/_way-shell/assets/", ShellApp.ImportMapOf(html).GetProperty("react").GetString());
        Assert.StartsWith("/demo/config/_way/way.js", way.GetProperty("moduleUrl").GetString());
        Assert.Equal("/demo/config/api", way.GetProperty("apiBase").GetString());
        Assert.Equal("/demo/", settings.GetProperty("links")[0].GetProperty("url").GetString());
    }

    [Fact]
    public async Task DynamicLinks_AreEvaluatedPerRequest_AfterTheStaticOnes()
    {
        await using var app = await ShellApp.StartAsync(
            a => a.MapWay(ShellApp.Module("config"), "/config").AllowAnonymous(),
            shell: o =>
            {
                o.Links.Add(new ShellLink("Home", "~/"));
                o.DynamicLinks.Add(c => c.User.IsInRole("Admin") ? [new ShellLink("Users", "~/users") { Icon = "users" }] : []);
                o.DynamicLinks.Add(_ => [new ShellLink("Docs", "/docs")]);
            });

        string[] TitlesFor(string html) =>
            [.. ShellApp.SettingsOf(html).GetProperty("links").EnumerateArray().Select(l => l.GetProperty("title").GetString()!)];

        Assert.Equal(["Home", "Docs"], TitlesFor(await (await app.GetAsync("/config/", user: "ada")).Content.ReadAsStringAsync()));
        Assert.Equal(["Home", "Users", "Docs"], TitlesFor(await (await app.GetAsync("/config/", user: "bob", roles: "Admin")).Content.ReadAsStringAsync()));
    }

    [Fact]
    public async Task AppRelativeUrls_GetThePathBase()
    {
        await using var app = await StartWithWay(o =>
        {
            o.HomeUrl = "~/";
            o.Links.Add(new ShellLink("Docs", "~/docs"));
            o.Links.Add(new ShellLink("External", "https://example.com/"));
            o.User = _ => new ShellUser("Ada") { AccountUrl = "~/account", SignOutUrl = "~/logout" };
        }, pathBase: "/p");

        var settings = ShellApp.SettingsOf(await (await app.GetAsync("/p/config/")).Content.ReadAsStringAsync());

        Assert.Equal("/p/", settings.GetProperty("homeUrl").GetString());
        Assert.Equal("/p/docs", settings.GetProperty("links")[0].GetProperty("url").GetString());
        Assert.Equal("https://example.com/", settings.GetProperty("links")[1].GetProperty("url").GetString());
        Assert.Equal("/p/account", settings.GetProperty("user").GetProperty("accountUrl").GetString());
        Assert.Equal("/p/logout", settings.GetProperty("user").GetProperty("signOutUrl").GetString());
    }

    [Fact]
    public async Task ModuleFiles_AreServedFromTheWaysAssembly_WithALongCache()
    {
        await using var app = await StartWithWay();

        var js = await app.GetAsync("/config/_way/way.js?v=1");
        var css = await app.GetAsync("/config/_way/way.css");

        Assert.Equal(HttpStatusCode.OK, js.StatusCode);
        Assert.Equal("text/javascript", js.Content.Headers.ContentType?.MediaType);
        Assert.Equal("public, max-age=31536000, immutable", js.Headers.CacheControl?.ToString());
        Assert.Contains(".test-way", await css.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task LazyChunksOfTheModule_AreServedNextToIt()
    {
        await using var app = await StartWithWay();

        var chunk = await app.GetAsync("/config/_way/chunks/details-T3st.js");

        Assert.Equal(HttpStatusCode.OK, chunk.StatusCode);
        Assert.Equal("text/javascript", chunk.Content.Headers.ContentType?.MediaType);
        Assert.Equal("public, max-age=31536000, immutable", chunk.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task SharedAssets_AreServedOnce_WithoutAuthorization()
    {
        await using var app = await ShellApp.StartAsync(
            a => a.MapWay(ShellApp.Module("config"), "/config").RequireAuthorization(),
            // A fallback policy protects everything that does not say otherwise; the shared libraries must still load.
            services: s => s.AddAuthorizationBuilder().SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build()));

        var imports = ShellApp.ImportMapOf(await (await app.GetAsync("/config/", user: "ada")).Content.ReadAsStringAsync());
        var react = await app.GetAsync(imports.GetProperty("react").GetString()!);

        Assert.Equal(HttpStatusCode.OK, react.StatusCode);
        Assert.Equal("public, max-age=31536000, immutable", react.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task WayApi_MappedOnTheGroup_Works()
    {
        await using var app = await ShellApp.StartAsync(a =>
            a.MapWay(ShellApp.Module("config"), "/config").AllowAnonymous().MapGet("/api/ping", () => "pong"));

        Assert.Equal("pong", await (await app.GetAsync("/config/api/ping")).Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task UnknownFile_UnderAWay_Is404()
    {
        await using var app = await StartWithWay();

        Assert.Equal(HttpStatusCode.NotFound, (await app.GetAsync("/config/nothing.js")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await app.GetAsync("/config/_way/nothing.js")).StatusCode);
    }

    [Fact]
    public void SameWay_CannotBeMountedTwice()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddWayShell();
        var app = builder.Build();
        app.MapWay(ShellApp.Module("config"), "/config");

        var error = Assert.Throws<InvalidOperationException>(() => app.MapWay(ShellApp.Module("config"), "/config2"));
        Assert.Contains("already mounted", error.Message);
    }

    [Fact]
    public void Way_WithoutItsBuiltModule_FailsAtStartup()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddWayShell();
        var app = builder.Build();

        var error = Assert.Throws<InvalidOperationException>(() =>
            app.MapWay(new WayModule("config", "Config", typeof(ShellApp).Assembly, "Missing/dist"), "/config"));
        Assert.Contains("wayModule()", error.Message);
    }

    [Fact]
    public void Way_CannotBeMountedAtTheRoot()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddWayShell();
        var app = builder.Build();

        Assert.Throws<ArgumentException>(() => app.MapWay(ShellApp.Module("config"), "/"));
    }

    [Fact]
    public void MapWay_WithoutAddWayShell_Explains()
    {
        var app = WebApplication.CreateBuilder().Build();

        var error = Assert.Throws<InvalidOperationException>(() => app.MapWay(ShellApp.Module("config"), "/config"));
        Assert.Contains("AddWayShell", error.Message);
    }
}
