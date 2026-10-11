/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Builds dist/VampCordInstaller.exe, a Windows installer bundling the desktop build from dist/.
// Run `pnpm build --standalone` first. Requires Go (https://go.dev/dl/)

import { execFileSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "fs";
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

execFileSync("go", ["build", "-trimpath", "-ldflags=-s -w", "-o", join(distDir, "VampCordInstaller.exe"), "."], {
    cwd: installerDir,
    stdio: "inherit",
    env: { ...process.env, GOOS: "windows", GOARCH: "amd64", CGO_ENABLED: "0" }
});

console.log("Built dist/VampCordInstaller.exe");
