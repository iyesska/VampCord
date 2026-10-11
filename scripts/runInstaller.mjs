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

import "./checkNodeVersion.js";

// Installs your local build (dist/) into Discord using VampCord's own installer (installer/).
// The installer is built with Go if it is installed, otherwise it is downloaded from this repository's latest release

import { execFileSync, spawnSync } from "child_process";
import { chmodSync, copyFileSync, createWriteStream, existsSync, mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { fileURLToPath } from "url";

const BASE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = join(BASE_DIR, "dist");
const INSTALLER_SRC = join(BASE_DIR, "installer");
const FILE_DIR = join(DIST_DIR, "Installer");
const DIST_FILES = ["patcher.js", "preload.js", "renderer.js", "renderer.css"];

const RELEASE_URL = "https://github.com/iyesska/VampCord/releases/download/devbuild/";

function getReleaseFilename() {
    switch (`${process.platform}-${process.arch}`) {
        case "win32-x64":
            return "VampCordInstaller.exe";
        case "linux-x64":
            return "VampCordInstaller-linux";
        case "darwin-x64":
            return "VampCordInstaller-macos-x64";
        case "darwin-arm64":
            return "VampCordInstaller-macos-arm64";
        default:
            throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
    }
}

function hasGo() {
    return spawnSync("go", ["version"], { stdio: "ignore" }).status === 0;
}

function buildWithGo(outputFile) {
    console.log("Building the installer with Go...");

    const embedDir = join(INSTALLER_SRC, "dist");
    rmSync(embedDir, { recursive: true, force: true });
    mkdirSync(embedDir);
    for (const file of DIST_FILES)
        copyFileSync(join(DIST_DIR, file), join(embedDir, file));

    execFileSync("go", ["build", "-o", outputFile, "."], { cwd: INSTALLER_SRC, stdio: "inherit" });
}

async function download(outputFile) {
    const url = RELEASE_URL + getReleaseFilename();
    console.log(`Go is not installed, downloading the installer from ${url}`);

    const res = await fetch(url, { headers: { "User-Agent": "VampCord (https://github.com/iyesska/VampCord)" } });
    if (!res.ok)
        throw new Error(`Failed to download the installer: ${res.status} ${res.statusText}. Install Go (https://go.dev/dl/) to build it locally instead`);

    await finished(Readable.fromWeb(res.body).pipe(createWriteStream(outputFile)));
    chmodSync(outputFile, 0o755);
}

for (const file of DIST_FILES) {
    if (!existsSync(join(DIST_DIR, file))) {
        console.error(`dist/${file} is missing. Run "pnpm build" first.`);
        process.exit(1);
    }
}

mkdirSync(FILE_DIR, { recursive: true });
const installerBin = join(FILE_DIR, process.platform === "win32" ? "vampcord-installer.exe" : "vampcord-installer");

if (hasGo())
    buildWithGo(installerBin);
else
    await download(installerBin);

const argStart = process.argv.indexOf("--");
const args = [...(argStart === -1 ? [] : process.argv.slice(argStart + 1)), "-dist", DIST_DIR];

console.log("Now running the installer...");
const { status } = spawnSync(installerBin, args, { stdio: "inherit" });

if (status !== 0) {
    console.error("\nSomething went wrong. Please check the logs above.");
    if (process.platform !== "win32")
        console.error(`If Discord is installed in a system folder, run:\n  sudo ${installerBin} ${args.map(a => JSON.stringify(a)).join(" ")}`);
    process.exit(status ?? 1);
}
