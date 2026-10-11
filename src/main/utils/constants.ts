/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { app } from "electron";
import { cpSync, existsSync } from "fs";
import { join } from "path";

/**
 * VampCord keeps its own data folder so it doesn't share settings with a Vencord install.
 * The first time it runs, settings and themes are copied over from the Vencord folder if there is one
 */
function getDataDir(parent: string, name: string, legacyName: string) {
    const dir = join(parent, name);

    try {
        const legacyDir = join(parent, legacyName);
        if (!existsSync(join(dir, "settings")) && existsSync(join(legacyDir, "settings"))) {
            for (const sub of ["settings", "themes"]) {
                if (existsSync(join(legacyDir, sub)))
                    cpSync(join(legacyDir, sub), join(dir, sub), { recursive: true });
            }
            console.info(`[VampCord] Copied settings and themes from ${legacyDir}`);
        }
    } catch (err) {
        console.error("[VampCord] Failed to copy settings from Vencord", err);
    }

    return dir;
}

export const DATA_DIR = process.env.VENCORD_USER_DATA_DIR ?? (
    process.env.DISCORD_USER_DATA_DIR
        ? getDataDir(join(process.env.DISCORD_USER_DATA_DIR, ".."), "VampCordData", "VencordData")
        : getDataDir(join(app.getPath("userData"), ".."), "VampCord", "Vencord")
);
export const SETTINGS_DIR = join(DATA_DIR, "settings");
export const THEMES_DIR = join(DATA_DIR, "themes");
export const QUICK_CSS_PATH = join(SETTINGS_DIR, "quickCss.css");
export const SETTINGS_FILE = join(SETTINGS_DIR, "settings.json");
export const NATIVE_SETTINGS_FILE = join(SETTINGS_DIR, "native-settings.json");
export const ALLOWED_PROTOCOLS = [
    "https:",
    "http:",
    "steam:",
    "spotify:",
    "com.epicgames.launcher:",
    "tidal:",
    "itunes:",
];

export const IS_VANILLA = /* @__PURE__ */ process.argv.includes("--vanilla");
