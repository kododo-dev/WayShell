namespace Kododo.Way.Shell;

/// <summary>The contract between Way.Shell and the UI modules of Way libraries.</summary>
public static class WayShellContract
{
    /// <summary>
    /// Version of the module contract, equal to the major version of Way.Shell. The shell refuses a module built for
    /// another one; <c>CONTRACT</c> in the <c>@kododo-dev/way-shell</c> npm package carries the same number.
    /// </summary>
    public const int Version = 2;
}
