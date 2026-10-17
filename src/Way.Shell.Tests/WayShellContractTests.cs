using System.Text.RegularExpressions;
using Xunit;

namespace Kododo.Way.Shell.Tests;

public sealed class WayShellContractTests
{
    [Fact]
    public void Version_IsTheOneOfTheNpmPackage()
    {
        // Both packages are released together from this repo; a module built with the npm package must be accepted
        // by the shell from the NuGet package of the same version.
        var contract = File.ReadAllText(Path.Combine(RepoSrc(), "way-shell", "src", "contract.ts"));
        var npmVersion = Regex.Match(contract, @"export const CONTRACT = (\d+);");

        Assert.True(npmVersion.Success, "CONTRACT not found in contract.ts");
        Assert.Equal(WayShellContract.Version, int.Parse(npmVersion.Groups[1].Value));
    }

    private static string RepoSrc()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            if (File.Exists(Path.Combine(dir.FullName, "WayShell.slnx")))
                return dir.FullName;
        throw new InvalidOperationException("src/WayShell.slnx not found above " + AppContext.BaseDirectory);
    }
}
