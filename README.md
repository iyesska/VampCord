<p align="center"><img src="installer/winres/icon.png" width="128" alt="VampCord logo"></p>

# VampCord

A Discord client mod with 100+ plugins, its own installer and its own update channel.

VampCord started as a fork of [Vencord](https://github.com/Vendicated/Vencord) (GPL-3.0) and is maintained independently
at [iyesska/VampCord](https://github.com/iyesska/VampCord). Credit for the original code goes to Vendicated and the
Vencord contributors.

## Features

-   **SecretMessages**: end-to-end encrypted messages right inside Discord. Turn on secret mode with the 🔒 button and
    everything you send is encrypted with AES-256. Only friends using VampCord with the same passphrase can read it,
    Discord only sees scrambled text
-   **Scheduler**: schedule messages (`/schedule message:... at:18:30`) and set reminders (`/remind about:... in:2h`),
    which survive restarting Discord
-   **UtilityCommands**: `/roll`, `/coinflip`, `/choose` and a safe `/calc`
-   100+ more built in plugins
-   Own installer for Windows, Linux and macOS
-   Own updates: installed copies update themselves from this repository's releases, and VampCord re-applies itself after Discord updates
-   Own data folder (`VampCord`), so it never clashes with a Vencord install. Your Vencord settings and themes are copied over the first time
-   Own badges (see [Badges](#badges))
-   Custom CSS and themes, with a built in editor (BetterDiscord themes work too)
-   Privacy friendly: blocks Discord analytics & crash reporting out of the box and has no telemetry
-   Browser extension and UserScript builds

### Fixes compared to Vencord

-   ClearURLs no longer strips legitimate URL params (eg `width` or `month` on Amazon links)
-   TextReplace keeps slashes in plain rules like `https://x.com/i` instead of mistaking them for regex flags
-   PreviewMessage frees attachment previews when the plugin is turned off
-   Badges keep working if one of the badge servers is down

## Installing / Uninstalling

Download the installer for your system from the [latest release](https://github.com/iyesska/VampCord/releases/latest):

| System                | File                            |
| --------------------- | ------------------------------- |
| Windows               | `VampCordInstaller.exe`         |
| Linux                 | `VampCordInstaller-linux`       |
| macOS (Apple Silicon) | `VampCordInstaller-macos-arm64` |
| macOS (Intel)         | `VampCordInstaller-macos-x64`   |

**Windows:** run it, pick your Discord install and choose **Install / Repair** or **Uninstall**. Windows may warn that the
app is unrecognised because it isn't signed, click **More info → Run anyway**.

**Linux:** Discord usually lives in a system folder, so run it with sudo:

```sh
chmod +x VampCordInstaller-linux
sudo ./VampCordInstaller-linux
```

Flatpak and Snap versions of Discord are sandboxed and can't be patched. Use the deb or tar.gz from discord.com instead.

**macOS:** open Terminal in the download folder and run:

```sh
xattr -d com.apple.quarantine VampCordInstaller-macos-*
chmod +x VampCordInstaller-macos-*
./VampCordInstaller-macos-arm64   # or -x64 on Intel Macs
```

If it can't modify Discord, allow Terminal under System Settings → Privacy & Security → App Management.

The installers also work without the menu: `-install` or `-uninstall`, with `-branch stable|ptb|canary|development|all`.

Uninstalling restores Discord exactly as it was. Your settings and themes are kept in the `VampCord` folder next to
Discord's data folder (`%APPDATA%\VampCord`, `~/.config/VampCord` or `~/Library/Application Support/VampCord`).

## Building from source

You need [Node.js](https://nodejs.org), [pnpm](https://pnpm.io) and, for the installer, [Go](https://go.dev/dl/).

```sh
pnpm install --frozen-lockfile
pnpm build            # build VampCord into dist/
pnpm inject           # install your build into Discord (pnpm uninject to remove it)
```

`pnpm inject` points Discord at your `dist/` folder, so after changing code you only need to `pnpm build` and restart
Discord. On Linux you may need to run the command it prints with sudo.

To build release files: `pnpm build --standalone` and then `pnpm buildInstaller`, which creates all installers in `dist/`.

Every push to `main` builds everything and publishes it as the `devbuild` release, which is where installed copies get
their updates from. For that, enable GitHub Actions in the repository's Actions tab.

## Badges

Badges are read from [`badges.json`](badges.json). To give someone a badge, add their Discord user ID:

```json
{
    "123456789012345678": [{ "tooltip": "VampCord Developer" }]
}
```

`badge` can optionally be set to an image URL, otherwise the VampCord logo is used.

## Disclaimer

Discord is trademark of Discord Inc. and solely mentioned for the sake of descriptivity.
Mention of it does not imply any affiliation with or endorsement by Discord Inc.

<details>
<summary>Using VampCord violates Discord's terms of service</summary>

Client modifications are against Discord’s Terms of Service.

However, Discord is pretty indifferent about them and there are no known cases of users getting banned for using client mods! So you should generally be fine as long as you don’t use any plugins that implement abusive behaviour. But no worries, all inbuilt plugins are safe to use!

Regardless, if your account is very important to you and it getting disabled would be a disaster for you, you should probably not use any client mods (not exclusive to VampCord), just to be safe

Additionally, make sure not to post screenshots with VampCord in a server where you might get banned for it

</details>
