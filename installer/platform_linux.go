/*
 * VampCord Installer
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

var linuxNames = map[string][]string{
	"stable":      {"discord", "Discord"},
	"ptb":         {"discord-ptb", "DiscordPTB"},
	"canary":      {"discord-canary", "DiscordCanary"},
	"development": {"discord-development", "DiscordDevelopment"},
}

var linuxProcesses = map[string]string{
	"stable":      "Discord",
	"ptb":         "DiscordPTB",
	"canary":      "DiscordCanary",
	"development": "DiscordDevelopment",
}

func configDir() string {
	if dir := os.Getenv("XDG_CONFIG_HOME"); dir != "" && sudoUser() == nil {
		return dir
	}
	return filepath.Join(homeDir(), ".config")
}

func findInstalls() []install {
	roots := []string{"/usr/share", "/usr/lib", "/usr/lib64", "/opt", filepath.Join(homeDir(), ".local", "share")}
	if dir := os.Getenv("VAMPCORD_DISCORD_ROOT"); dir != "" {
		roots = append([]string{dir}, roots...)
	}

	var candidates []candidate
	for _, key := range branchOrder {
		for _, root := range roots {
			for _, name := range linuxNames[key] {
				dir := filepath.Join(root, name)
				candidates = append(candidates, candidate{
					key:       key,
					resources: filepath.Join(dir, "resources"),
					process:   linuxProcesses[key],
					launch:    filepath.Join(dir, linuxProcesses[key]),
				})
			}
		}
	}

	found := findFirst(candidates)
	if len(found) == 0 {
		if _, err := os.Stat("/var/lib/flatpak/app/com.discordapp.Discord"); err == nil {
			fmt.Println(yellow("Discord from Flatpak was found. Flatpak apps are sandboxed and can't be patched by this installer,"))
			fmt.Println(yellow("please install Discord from https://discord.com/download (deb or tar.gz) instead."))
		}
	}
	return found
}

func startDiscord(inst install) {
	// Never start Discord as root
	if os.Geteuid() == 0 {
		return
	}
	if _, err := os.Stat(inst.launch); err != nil {
		return
	}
	fmt.Printf("  Starting %s...\n", inst.name)
	cmd := exec.Command(inst.launch)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	_ = cmd.Start()
}

func openFolder(path string) {
	_ = os.MkdirAll(path, 0o755)
	fixOwnership(path)
	fmt.Println("  " + path)
	if os.Geteuid() != 0 {
		_ = exec.Command("xdg-open", path).Start()
	}
}

func permissionHint() string {
	return "Discord is installed in a system folder, run the installer with sudo"
}
