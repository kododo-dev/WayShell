using Microsoft.AspNetCore.Http;

namespace Kododo.Way.Shell;

/// <summary>
/// Settings of the host shared by every Way: one place instead of each Way's own UI options. URLs starting with
/// <c>~/</c> are relative to the app and get its path base.
/// </summary>
public sealed class ShellOptions
{
    /// <summary>Title at the top of the menu and in the browser tab. Default: the Way's name, or <c>Admin</c> in the panel.</summary>
    public string? Title { get; set; }

    /// <summary>Where the title links to, e.g. the host app's home page; no link when not set.</summary>
    public string? HomeUrl { get; set; }

    /// <summary>Language of the UI, e.g. <c>en</c> or <c>pl</c>. Default: the browser's.</summary>
    public string? Language { get; set; }

    /// <summary>Links of the host, at the bottom of the shell's menu.</summary>
    public IList<ShellLink> Links { get; } = [];

    /// <summary>
    /// Links evaluated on every request, after <see cref="Links"/>: links that depend on the user, e.g. only for
    /// administrators. Each Way and the host can add their own.
    /// </summary>
    public IList<Func<HttpContext, IEnumerable<ShellLink>>> DynamicLinks { get; } = [];

    /// <summary>
    /// The signed-in user at the bottom of the shell's menu. Default: the name of an authenticated user, without a sign-out link.
    /// Return <see langword="null"/> to show no user.
    /// </summary>
    public Func<HttpContext, ShellUser?> User { get; set; } = DefaultUser;

    /// <summary>
    /// Lets Ways and the panel answer without authorization outside the Development environment. Only for public
    /// demos or hosts protected by other means; otherwise call <c>RequireAuthorization()</c> on what <c>Use*Way()</c>
    /// and <c>UseWayShell()</c> return.
    /// </summary>
    public bool AllowAnonymous { get; set; }

    /// <summary>
    /// Path the shared libraries and the shell app are served from, once for every Way. They are public files and
    /// answer without authorization. Default: <c>/_way-shell</c>.
    /// </summary>
    public string AssetsPath { get; set; } = "/_way-shell";

    /// <summary>
    /// Nonce for the shell's inline import map and its scripts, for a <c>Content-Security-Policy</c> with
    /// <c>script-src 'nonce-...'</c>; no nonce when it returns <see langword="null"/>.
    /// </summary>
    public Func<HttpContext, string?> Nonce { get; set; } = _ => null;

    private static ShellUser? DefaultUser(HttpContext context) =>
        context.User.Identity is { IsAuthenticated: true } identity ? new ShellUser(identity.Name ?? "") : null;
}

/// <summary>A user as the shell shows it.</summary>
/// <param name="Name">Name shown at the bottom of the menu.</param>
public sealed record ShellUser(string Name)
{
    /// <summary>Page of the user's account the name links to; no link when not set.</summary>
    public string? AccountUrl { get; init; }

    /// <summary>
    /// Where the sign-out button posts a form to; no button when not set. A POST, not a link, so the host can protect
    /// it against cross-site requests.
    /// </summary>
    public string? SignOutUrl { get; init; }
}

/// <summary>A link of the host at the bottom of the shell's menu.</summary>
public sealed record ShellLink(string Title, string Url)
{
    /// <summary>
    /// Icon by name: <c>home</c>, <c>settings</c>, <c>translate</c>, <c>schedule</c>, <c>logs</c>, <c>traces</c>,
    /// <c>people</c>, <c>key</c>, <c>history</c>, <c>storage</c>, <c>dashboard</c>; an arrow otherwise.
    /// </summary>
    public string? Icon { get; init; }
}
