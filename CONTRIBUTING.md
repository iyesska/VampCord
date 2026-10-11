# Contributing to VampCord

VampCord welcomes contributions! Bug reports, feature ideas and pull requests are all appreciated.

## Reporting bugs and requesting features

Open an issue on [GitHub](https://github.com/iyesska/VampCord/issues). For bugs, run `/vampcord-debug` in Discord and
include its output.

## Writing code

1. Fork the repository and create a branch
2. `pnpm install --frozen-lockfile`
3. Make your changes. Plugins live in `src/plugins`, each in its own folder with an `index.ts(x)` and ideally a `README.md`
4. `pnpm build` and `pnpm inject` to try your changes in Discord
5. Run `pnpm test` (type check, lint and build) and, if you touched the installer, `go test ./...` in `installer/`
6. Open a pull request describing what you changed and why

Please keep the license header at the top of every source file. VampCord is licensed under the GPL-3.0, which requires
keeping the original copyright notices.

## Plugin guidelines

-   Plugins must not do anything malicious, like logging tokens or self botting
-   Prefer using the existing APIs (`@api/*`) and helpers (`@utils/*`) over reinventing them
-   Keep patches small and specific so they survive Discord updates
