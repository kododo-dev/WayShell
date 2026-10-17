using Microsoft.Extensions.FileProviders;

namespace Kododo.Way.Shell;

/// <summary>A Way mounted in the app: its module and the path <c>Use*Way</c> put it at.</summary>
internal sealed record RegisteredWay
{
    public RegisteredWay(WayModule module, string path)
    {
        Module = module;
        Path = path;
        Version = module.Assembly.ManifestModule.ModuleVersionId.ToString("N")[..12];
        var assembly = module.Assembly.GetName().Name;
        if (module.Assembly.GetManifestResourceInfo("Microsoft.Extensions.FileProviders.Embedded.Manifest.xml") is null)
            throw new InvalidOperationException(
                $"The Way '{module.Id}' has no embedded files manifest in {assembly}. Set " +
                "<GenerateEmbeddedFilesManifest>true</GenerateEmbeddedFilesManifest> and embed the module " +
                $"({module.ResourceRoot}) as EmbeddedResource.");

        IFileProvider? files = null;
        try
        {
            files = new ManifestEmbeddedFileProvider(module.Assembly, module.ResourceRoot);
        }
        catch (InvalidOperationException)
        {
            // the root folder is not embedded: reported below as a missing module
        }
        if (files is null || !files.GetFileInfo("way.js").Exists)
            throw new InvalidOperationException(
                $"The Way '{module.Id}' has no {module.ResourceRoot}/way.js embedded in {assembly}. " +
                "Build its UI with the wayModule() preset of @kododo-dev/way-shell before building the assembly.");
        HasCss = files.GetFileInfo("way.css").Exists;
    }

    public WayModule Module { get; }
    public string Path { get; }

    /// <summary>Changes with every build of the Way's assembly, so browsers fetch its module again after an update.</summary>
    public string Version { get; }

    public bool HasCss { get; }
}

/// <summary>Every Way mounted in the app, in the order they were mounted.</summary>
internal sealed class WayRegistry
{
    private readonly List<RegisteredWay> _ways = [];
    private readonly object _lock = new(); // System.Threading.Lock is not in net8.0

    public IReadOnlyList<RegisteredWay> Ways
    {
        get
        {
            lock (_lock) return [.. _ways];
        }
    }

    public bool AssetsMapped { get; set; }

    public RegisteredWay Add(WayModule module, string path)
    {
        lock (_lock)
        {
            if (_ways.Any(w => w.Module.Id == module.Id))
                throw new InvalidOperationException($"The Way '{module.Id}' is already mounted; a Way can be mounted once per app.");
            var way = new RegisteredWay(module, path);
            _ways.Add(way);
            return way;
        }
    }
}

/// <summary>Marks every endpoint of a Way, so the shell can find the authorization the host put on it.</summary>
internal sealed record WayEndpointMetadata(string Id);

/// <summary>Marks the endpoints of the panel.</summary>
internal sealed record ShellPanelMetadata;
