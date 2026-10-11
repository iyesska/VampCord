/*
 * VampCord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Builds the VampCord installers for Windows, Linux and macOS, bundling the desktop build from dist/.
// Run `pnpm build --standalone` first. Requires Go (https://go.dev/dl/)

import { execFileSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import { join } from "path";

const FILES = ["patcher.js", "preload.js", "renderer.js", "renderer.css"];
const installerDir = join(import.meta.dirname, "..", "installer");
const distDir = join(import.meta.dirname, "..", "dist");
const embedDir = join(installerDir, "dist");

for (const file of FILES) {
    if (!existsSync(join(distDir, file))) {
        console.error(`dist/${file} is missing. Run "pnpm build --standalone" first.`);
        process.exit(1);
    }
}

rmSync(embedDir, { recursive: true, force: true });
mkdirSync(embedDir);
for (const file of FILES)
    copyFileSync(join(distDir, file), join(embedDir, file));

const { version } = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf-8"));
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf-8" }).trim();

// Icon, version info and manifest for the exe
execFileSync("go", [
    "run", "github.com/tc-hib/go-winres@v0.3.3", "make",
    "--in", "winres/winres.json", "--out", "rsrc", "--arch", "amd64",
    "--product-version", version, "--file-version", version
], { cwd: installerDir, stdio: "inherit" });

const TARGETS = [
    ["windows", "amd64", "VampCordInstaller.exe"],
    ["linux", "amd64", "VampCordInstaller-linux"],
    ["darwin", "amd64", "VampCordInstaller-macos-x64"],
    ["darwin", "arm64", "VampCordInstaller-macos-arm64"],
];

for (const [goos, goarch, filename] of TARGETS) {
    execFileSync("go", [
        "build", "-trimpath",
        `-ldflags=-s -w -X main.version=${version} -X main.commit=${commit}`,
        "-o", join(distDir, filename), "."
    ], {
        cwd: installerDir,
        stdio: "inherit",
        env: { ...process.env, GOOS: goos, GOARCH: goarch, CGO_ENABLED: "0" }
    });
    console.log(`Built dist/${filename}`);
}
