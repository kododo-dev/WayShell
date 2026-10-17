using Xunit;

namespace Kododo.Way.Shell.Tests;

public sealed class WayModuleTests
{
    private static readonly System.Reflection.Assembly Assembly = typeof(WayModuleTests).Assembly;

    [Theory]
    [InlineData("config")]
    [InlineData("culture-way")]
    [InlineData("logs2")]
    public void AcceptsIds_UsableInUrlsAndRoutes(string id)
    {
        Assert.Equal(id, new WayModule(id, "Name", Assembly, "SPA/dist").Id);
    }

    [Theory]
    [InlineData("")]
    [InlineData("Config")]
    [InlineData("2logs")]
    [InlineData("config way")]
    [InlineData("config/way")]
    [InlineData("-config")]
    public void RejectsIds_ThatWouldBreakUrlsOrRoutes(string id)
    {
        var error = Assert.Throws<ArgumentException>(() => new WayModule(id, "Name", Assembly, "SPA/dist"));
        Assert.Equal("id", error.ParamName);
    }

    [Theory]
    [InlineData("SPA/dist", "SPA/dist")]
    [InlineData(@"SPA\dist\", "SPA/dist")]
    [InlineData("/ui/", "ui")]
    public void NormalizesTheResourceRoot(string root, string expected)
    {
        Assert.Equal(expected, new WayModule("config", "Name", Assembly, root).ResourceRoot);
    }

    [Fact]
    public void RequiresAName()
    {
        Assert.Throws<ArgumentException>(() => new WayModule("config", " ", Assembly, "SPA/dist"));
    }
}
