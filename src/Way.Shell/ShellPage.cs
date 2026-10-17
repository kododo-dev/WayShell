using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Kododo.Reiho.AspNetCore.SPA;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;

namespace Kododo.Way.Shell;

/// <summary>
/// The shell's page: <c>UI/page/index.html</c> served by Reiho's <c>MapEmbeddedSpa</c>, with the import map, the
/// shell app and its settings put in per request.
/// </summary>
internal static class ShellPage
{
    public const string RootPath = "UI/page";
    public const string AssetsRootPath = "UI/dist";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly Lazy<ShellManifest> Manifest = new(LoadManifest);

    public static void Configure(EmbeddedSpaOptions spa, string groupPath,
        Func<HttpContext, Task<IReadOnlyList<RegisteredWay>>> ways, Func<HttpContext, string> defaultTitle, string mode, string? wayId)
    {
        _ = Manifest.Value; // fail at startup, not on the first request, when the UI was not built
        spa.RootPath = RootPath;
        // Every URL of the shell starts with AppBase: the page's own placeholder rather than Reiho's __BASE_PATH__, which is
        // relative to the page's path.
        spa.Placeholder("__WAY_SHELL_BASE__", context => HtmlEncoder.Default.Encode($"{AppBase(context)}{groupPath}/"));
        spa.Placeholder("__WAY_SHELL_LANG__", context => HtmlEncoder.Default.Encode(Options(context).Language ?? "en"));
        spa.Placeholder("__WAY_SHELL_TITLE__", context => HtmlEncoder.Default.Encode(Options(context).Title ?? defaultTitle(context)));
        spa.Placeholder("__WAY_SHELL_HEAD__", async context =>
            Head(context, Settings(context, await ways(context), defaultTitle(context), mode, wayId)));
    }

    /// <summary>
    /// Where the app is in the browser's address: <c>Request.PathBase</c>, after the <c>PathBase</c> setting for a prefix a
    /// reverse proxy stripped before the request reached the app (<c>ASPNETCORE_PATHBASE</c> without <c>UsePathBase</c>).
    /// When the app applied the setting itself with <c>UsePathBase</c>, it is already in <c>Request.PathBase</c> and is
    /// not added again; Reiho's SPA does the same.
    /// </summary>
    internal static string AppBase(HttpContext context)
    {
        var requestBase = context.Request.PathBase.Value ?? "";
        var configured = context.RequestServices.GetService<IConfiguration>()?["PathBase"];
        if (string.IsNullOrWhiteSpace(configured)) return requestBase;
        var prefix = "/" + configured.Trim().Trim('/');
        if (prefix == "/") return requestBase;
        var applied = requestBase.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) &&
                      (requestBase.Length == prefix.Length || requestBase[prefix.Length] == '/');
        return applied ? requestBase : prefix + requestBase;
    }

    private static ShellOptions Options(HttpContext context) =>
        context.RequestServices.GetRequiredService<IOptions<ShellOptions>>().Value;

    private static ShellSettings Settings(HttpContext context, IReadOnlyList<RegisteredWay> ways, string defaultTitle, string mode, string? wayId)
    {
        var options = Options(context);
        var pathBase = AppBase(context);
        string? Resolve(string? url) => url is not null && url.StartsWith("~/", StringComparison.Ordinal) ? pathBase + url[1..] : url;
        var user = options.User(context);
        return new ShellSettings(
            Title: options.Title ?? defaultTitle,
            HomeUrl: Resolve(options.HomeUrl),
            Language: options.Language,
            Links: [.. options.Links.Concat(options.DynamicLinks.SelectMany(links => links(context))).Select(l => l with { Url = Resolve(l.Url)! })],
            User: user is null ? null : user with { AccountUrl = Resolve(user.AccountUrl), SignOutUrl = Resolve(user.SignOutUrl) },
            Mode: mode,
            WayId: wayId,
            Ways: [.. ways.Select(w => new WayInfo(
                Id: w.Module.Id,
                Name: w.Module.Name,
                Icon: w.Module.Icon,
                Url: $"{pathBase}{w.Path}/",
                ApiBase: $"{pathBase}{w.Path}/api",
                ModuleUrl: $"{pathBase}{w.Path}/{ShellEndpoints.ModulePath}/way.js?v={w.Version}",
                CssUrl: w.HasCss ? $"{pathBase}{w.Path}/{ShellEndpoints.ModulePath}/way.css?v={w.Version}" : null,
                Settings: new Dictionary<string, object?>()))]);
    }

    /// <summary>Import map, preloads, the settings as JSON and the shell app; everything with the app's path base.</summary>
    private static string Head(HttpContext context, ShellSettings settings)
    {
        var options = Options(context);
        var assets = $"{AppBase(context)}{ShellEndpoints.Normalize(options.AssetsPath)}/";
        var nonce = options.Nonce(context) is { Length: > 0 } value ? $" nonce=\"{HtmlEncoder.Default.Encode(value)}\"" : "";
        var manifest = Manifest.Value;

        var importMap = JsonSerializer.Serialize(new { imports = manifest.Imports.ToDictionary(i => i.Key, i => assets + i.Value) }, Json);
        var head = new StringBuilder();
        head.Append($"<script type=\"importmap\"{nonce}>{importMap}</script>\n");
        foreach (var file in manifest.Preload)
            head.Append($"<link rel=\"modulepreload\" href=\"{HtmlEncoder.Default.Encode(assets + file)}\">\n");
        foreach (var file in manifest.Css)
            head.Append($"<link rel=\"stylesheet\" href=\"{HtmlEncoder.Default.Encode(assets + file)}\">\n");
        // System.Text.Json escapes <, > and &, so the JSON cannot close the script element.
        head.Append($"<script type=\"application/json\" id=\"way-shell-settings\">{JsonSerializer.Serialize(settings, Json)}</script>\n");
        head.Append($"<script type=\"module\"{nonce} src=\"{HtmlEncoder.Default.Encode(assets + manifest.Entry)}\"></script>");
        return head.ToString();
    }

    private static ShellManifest LoadManifest()
    {
        var file = new ManifestEmbeddedFileProvider(typeof(ShellPage).Assembly, AssetsRootPath).GetFileInfo("shell.json");
        if (!file.Exists)
            throw new InvalidOperationException(
                "Kododo.Way.Shell was built without its UI (UI/dist/shell.json is missing). Run `npm ci && npm run build` in src/Way.Shell/UI.");
        using var stream = file.CreateReadStream();
        return JsonSerializer.Deserialize<ShellManifest>(stream, Json)!;
    }

    private sealed record ShellManifest(Dictionary<string, string> Imports, string Entry, string[] Preload, string[] Css);
}

/// <summary>What the shell app reads from the page; mirrors src/settings.ts of the UI.</summary>
internal sealed record ShellSettings(
    string Title,
    string? HomeUrl,
    string? Language,
    ShellLink[] Links,
    ShellUser? User,
    string Mode,
    string? WayId,
    WayInfo[] Ways);

internal sealed record WayInfo(
    string Id,
    string Name,
    string? Icon,
    string Url,
    string ApiBase,
    string ModuleUrl,
    string? CssUrl,
    Dictionary<string, object?> Settings);
