# Kododo.Way.Shell

Shared UI shell for the Kododo Way libraries (ConfigWay, CultureWay, RunWay, LogWay).

> **Status:** in development, not released yet. Way libraries move to the shell with the 2.0 release of the family.

- **One Way in an app:** the Way looks and works as before (`app.UseConfigWay("/config")`), but its layout, theme, language and session handling come from the shell.
- **Several Ways in an app:** an optional panel (for example `/admin`) with navigation between all of them, one theme and one signed-in user.
- **One React and MUI in an app:** the shell serves the shared libraries once, through an import map, to every Way.

## In an app

Way libraries register the shell themselves. Configure it and add the panel when you want one:

```csharp
builder.Services.AddWayShell(o =>
{
    o.Title = "Acme admin";
    o.HomeUrl = "/";
    o.Links.Add(new ShellLink("Docs", "/docs"));
    o.User = ctx => ctx.User.Identity?.IsAuthenticated == true
        ? new ShellUser(ctx.User.Identity.Name!) { SignOutUrl = "/logout" }
        : null;
});

app.UseConfigWay("/config").RequireAuthorization("Admin");
app.UseCultureWay("/translations").RequireAuthorization();
app.UseWayShell("/admin").RequireAuthorization();   // lists the Ways the user may open
```

Outside the Development environment a Way or the panel answers `403` until you decide on its authorization: `RequireAuthorization(...)`, `AllowAnonymous()`, a fallback policy, or `ShellOptions.AllowAnonymous` for public demos. Undecided ones are reported in the log at startup.

## In a Way library

```csharp
public static RouteGroupBuilder UseMyWay(this IEndpointRouteBuilder endpoints, string path = "/my")
{
    var group = endpoints.MapWay(new WayModule("my", "My Way", typeof(MyWay).Assembly, "SPA/dist"), path);
    group.MapGroup("/api").MapRequests(typeof(MyWay).Assembly);   // the shell gives the module {path}/api as apiBase
    return group;
}
```

The module (`SPA/dist/way.js`, `way.css`) is built with the [`@kododo-dev/way-shell`](https://www.npmjs.com/package/@kododo-dev/way-shell) npm package of the same version and embedded with `<GenerateEmbeddedFilesManifest>true</GenerateEmbeddedFilesManifest>`.

## License

MIT
