using System.Security.Claims;
using Kododo.Way.Shell;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

// Way.Shell with two Ways and the panel. Both Ways use the same demo module (UI/), standing in for real Way libraries.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o => o.LoginPath = "/login");
builder.Services.AddAuthorization(o => o.AddPolicy("Admin", p => p.RequireRole("Admin")));
builder.Services.AddWayShell(o =>
{
    o.Title = "Way.Shell demo";
    o.HomeUrl = "~/";
    o.Notice = "A public demo: sign in as anyone from the home page.";
    o.Links.Add(new ShellLink("Home", "~/") { Icon = "home" });
    o.Links.Add(new ShellLink("GitHub", "https://github.com/kododo-dev/WayShell"));
    o.User = context => context.User.Identity is { IsAuthenticated: true, Name: { } name }
        ? new ShellUser(name) { AccountUrl = "~/admin/#/account/", SignOutUrl = "~/logout" }
        : null;
});

var app = builder.Build();
if (app.Configuration["PathBase"] is { Length: > 0 } pathBase)
{
    app.UsePathBase(pathBase);
    app.UseRouting();
}
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", (HttpContext c) => Results.Content($"""
    <!doctype html><title>Way.Shell demo</title>
    <h1>Way.Shell demo</h1>
    <p>Signed in as {System.Net.WebUtility.HtmlEncode(c.User.Identity?.Name ?? "nobody")}.
       Sign in as <a href="login?user=ada&amp;returnUrl=admin/">ada</a> or
       <a href="login?user=bob&amp;roles=Admin&amp;returnUrl=admin/">bob (Admin)</a>, <a href="logout">sign out</a>.</p>
    <ul>
      <li><a href="hello/">/hello</a>: anyone</li>
      <li><a href="reports/">/reports</a>: Admin only</li>
      <li><a href="admin/">/admin</a>: the panel, any signed-in user; it lists the Ways they may open</li>
    </ul>
    """, "text/html"));

// Demo only: sign in as anyone.
app.MapGet("/login", async (HttpContext c, string? user, string? roles, string? returnUrl) =>
{
    if (user is null) return Results.Redirect($"{c.Request.PathBase}/");
    var claims = new List<Claim> { new(ClaimTypes.Name, user) };
    claims.AddRange((roles ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).Select(r => new Claim(ClaimTypes.Role, r)));
    await c.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));
    return Results.Redirect($"{c.Request.PathBase}/{(returnUrl ?? "").TrimStart('/')}");
});
// The shell posts a form to sign out; the link on the home page uses GET.
app.MapMethods("/logout", ["GET", "POST"], async (HttpContext c) =>
{
    await c.SignOutAsync();
    return Results.Redirect($"{c.Request.PathBase}/");
}).DisableAntiforgery();

app.UseDemoWay("hello", "Hello", "/hello", "dashboard").AllowAnonymous();
app.UseDemoWay("reports", "Reports", "/reports", "logs").RequireAuthorization("Admin");
// Not in the panel's menu: the user's name links to it.
app.UseDemoWay("account", "Account", "/account", "people", hidden: true).RequireAuthorization();
app.UseWayShell("/admin").RequireAuthorization();

app.Run();

/// <summary>What a Way library's Use…Way() does: mount the shell with its module and map its API on the group.</summary>
internal static class DemoWay
{
    public static RouteGroupBuilder UseDemoWay(this IEndpointRouteBuilder endpoints, string id, string name, string path, string icon, bool hidden = false)
    {
        var group = endpoints.MapWay(new WayModule(id, name, typeof(DemoWay).Assembly, "UI/dist") { Icon = icon, IsHidden = hidden }, path);
        // As Reiho maps requests: POST {path}/api/{Request}.
        group.MapPost("/api/Hello", (HttpContext c) => new { way = id, user = c.User.Identity?.Name, time = DateTimeOffset.Now.ToString("T") });
        group.MapPost("/api/Expire", () => Results.Unauthorized());
        return group;
    }
}
