# Way.Shell

Shared UI shell for the [Kododo](https://github.com/kododo-dev) Way libraries: [ConfigWay](https://github.com/kododo-dev/ConfigWay), [CultureWay](https://github.com/kododo-dev/CultureWay), and [RunWay](https://github.com/kododo-dev/RunWay), from version 2.0 of each.

Each Way embeds a web UI in an ASP.NET Core app. Before 2.0 every Way shipped its own React app with its own copy of the layout, theme, translations and API client. Way.Shell takes those over:

- **One Way in an app** looks and works as before (`app.UseConfigWay("/config")`), with the layout, theme, language and session handling coming from the shell.
- **Several Ways in an app** can also be shown together in one panel (for example `/admin`), with one menu, theme and user.
- **One React and MUI per app:** the shell serves the shared libraries once, through an import map, and each Way's UI is a small ES module loaded into it.

## Packages

| Package | What it is |
|---|---|
| [`Kododo.Way.Shell`](src/Way.Shell) (NuGet, net8/9/10) | The shell: Way registry, shell page and API, shared libraries, the optional panel. Referenced by every Way library. |
| [`@kododo-dev/way-shell`](src/way-shell) (npm) | Module contract, runtime hooks and the `wayModule()` Vite preset for building a Way's UI. |

Both are versioned and released together from this repository; the major version is the version of the module contract.

## Building

```bash
# npm package
cd src/way-shell
npm ci
npm run lint && npm run typecheck && npm test && npm run build

# the shell's UI (embedded in Kododo.Way.Shell) and the demo's module
cd ../Way.Shell/UI && npm ci && npm run build
cd ../../Way.Shell.Demo/UI && npm ci && npm run build

# .NET
cd ../.. && dotnet test WayShell.slnx
dotnet run --project Way.Shell.Demo   # http://localhost:5085
```

The design and the plan (in Polish) are in [docs/architecture.md](docs/architecture.md).

## License

[MIT](LICENSE)
