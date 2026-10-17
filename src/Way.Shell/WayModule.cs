using System.Reflection;
using System.Text.RegularExpressions;

namespace Kododo.Way.Shell;

/// <summary>
/// What a Way library tells the shell about its UI: who it is and where its module (<c>way.js</c>, <c>way.css</c>,
/// built with the <c>wayModule()</c> Vite preset) is embedded.
/// </summary>
public sealed partial record WayModule
{
    /// <param name="id">
    /// Stable id: lowercase letters, digits and dashes, starting with a letter. It appears in URLs and in the panel's
    /// routes (<c>/admin#/{id}/...</c>), so changing it breaks links.
    /// </param>
    /// <param name="name">Name shown in the panel's menu and as the default title.</param>
    /// <param name="assembly">Assembly the module is embedded in.</param>
    /// <param name="resourceRoot">Folder of the module inside the embedded resources, e.g. <c>SPA/dist</c>.</param>
    public WayModule(string id, string name, Assembly assembly, string resourceRoot)
    {
        if (!IdPattern().IsMatch(id))
            throw new ArgumentException(
                $"'{id}' is not a valid Way id: use lowercase letters, digits and dashes, starting with a letter.", nameof(id));
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentNullException.ThrowIfNull(assembly);
        ArgumentException.ThrowIfNullOrWhiteSpace(resourceRoot);

        Id = id;
        Name = name;
        Assembly = assembly;
        ResourceRoot = resourceRoot.Replace('\\', '/').Trim('/');
    }

    public string Id { get; }
    public string Name { get; }
    public Assembly Assembly { get; }
    public string ResourceRoot { get; }

    /// <summary>
    /// Icon in the panel's menu by name: <c>settings</c>, <c>translate</c>, <c>schedule</c>, <c>logs</c>, <c>traces</c>,
    /// <c>people</c>, <c>key</c>, <c>history</c>, <c>storage</c>, <c>dashboard</c>, <c>home</c>; a generic icon otherwise.
    /// </summary>
    public string? Icon { get; init; }

    /// <summary>
    /// The Way exposes data that needs care beyond the host's own authorization (LogWay: logs). The panel lists it
    /// only for users the Way's own policy lets in, and never caches its settings.
    /// </summary>
    public bool IsSensitive { get; init; }

    /// <summary>
    /// The panel does not list the Way in its menu; it still opens at <c>#/{id}/</c>, e.g. from a link in the host's
    /// options (<c>~/#/account/</c> as <see cref="ShellUser.AccountUrl"/>) or from another Way.
    /// </summary>
    public bool IsHidden { get; init; }

    [GeneratedRegex("^[a-z][a-z0-9-]*$")]
    private static partial Regex IdPattern();
}
