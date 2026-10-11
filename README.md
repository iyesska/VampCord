# VampCord

> Fork de [Vencord](https://github.com/Vendicated/Vencord).

The cutest Discord client mod

![](https://github.com/user-attachments/assets/3fac98c0-c411-4d2a-97a3-13b7da8687a2)

## Features

-   Easy to install
-   [100+ built in plugins](https://vencord.dev/plugins)
-   Fairly lightweight despite the many inbuilt plugins
-   Excellent Browser Support: Run VampCord in your Browser via extension or UserScript
-   Works on any Discord branch: Stable, Canary or PTB all work
-   Custom CSS and Themes: Inbuilt css editor with support to import any css files (including BetterDiscord themes)
-   Privacy friendly: blocks Discord analytics & crash reporting out of the box and has no telemetry
-   Maintained very actively, broken plugins are usually fixed within 12 hours
-   Settings sync: Keep your plugins and their settings synchronised between devices / apps (optional)


## What's new in VampCord

-   **UtilityCommands** plugin: `/roll`, `/coinflip`, `/choose` and a safe `/calc` calculator
-   ClearURLs no longer strips legitimate URL params (eg `width` or `month` on Amazon links)
-   TextReplace keeps slashes in plain rules like `https://x.com/i` instead of mistaking them for regex flags
-   PreviewMessage frees attachment previews when the plugin is turned off

## Installing / Uninstalling

See the [upstream Vencord instructions](https://docs.vencord.dev/installing/) and build from this repository:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm inject
```

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
