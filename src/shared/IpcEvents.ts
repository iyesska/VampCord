/*
 * VampCord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

export const enum IpcEvents {
    INIT_FILE_WATCHERS = "VampCordInitFileWatchers",

    OPEN_QUICKCSS = "VampCordOpenQuickCss",
    GET_QUICK_CSS = "VampCordGetQuickCss",
    SET_QUICK_CSS = "VampCordSetQuickCss",
    QUICK_CSS_UPDATE = "VampCordQuickCssUpdate",

    GET_SETTINGS = "VampCordGetSettings",
    SET_SETTINGS = "VampCordSetSettings",

    GET_THEMES_LIST = "VampCordGetThemesList",
    GET_THEME_DATA = "VampCordGetThemeData",
    GET_THEME_SYSTEM_VALUES = "VampCordGetThemeSystemValues",
    THEME_UPDATE = "VampCordThemeUpdate",

    OPEN_EXTERNAL = "VampCordOpenExternal",
    OPEN_THEMES_FOLDER = "VampCordOpenThemesFolder",
    OPEN_SETTINGS_FOLDER = "VampCordOpenSettingsFolder",

    GET_UPDATES = "VampCordGetUpdates",
    GET_REPO = "VampCordGetRepo",
    UPDATE = "VampCordUpdate",
    BUILD = "VampCordBuild",

    OPEN_MONACO_EDITOR = "VampCordOpenMonacoEditor",
    GET_MONACO_THEME = "VampCordGetMonacoTheme",

    GET_PLUGIN_IPC_METHOD_MAP = "VampCordGetPluginIpcMethodMap",

    CSP_IS_DOMAIN_ALLOWED = "VampCordCspIsDomainAllowed",
    CSP_REMOVE_OVERRIDE = "VampCordCspRemoveOverride",
    CSP_REQUEST_ADD_OVERRIDE = "VampCordCspRequestAddOverride",

    GET_RENDERER_CSS = "VampCordGetRendererCss",
    RENDERER_CSS_UPDATE = "VampCordRendererCssUpdate",
    PRELOAD_GET_RENDERER_JS = "VampCordPreloadGetRendererJs",

    SUPPORTS_WINDOWS_MATERIAL = "VampCordSupportsWindowsMaterial",
}
