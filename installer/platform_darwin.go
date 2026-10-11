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
)

var macApps = map[string]string{
	"stable":      "Discord",
	"ptb":         "Discord PTB",
	"canary":      "Discord Canary",
	"development": "Discord Development",
}

func configDir() string {
	return filepath.Join(homeDir(), "Library", "Application Support")
}

func findInstalls() []install {
	var candidates []candidate
	for _, key := range branchOrder {
		for _, root := range []string{"/Applications", filepath.Join(homeDir(), "Applications")} {
			app := filepath.Join(root, macApps[key]+".app")
			candidates = append(candidates, candidate{
				key:       key,
				resources: filepath.Join(app, "Contents", "Resources"),
				process:   macApps[key],
				launch:    app,
			})
		}
	}
	return findFirst(candidates)
}

func startDiscord(inst install) {
	if os.Geteuid() == 0 {
		return
	}
	fmt.Printf("  Starting %s...\n", inst.name)
	_ = exec.Command("open", "-a", inst.launch).Start()
}

func openFolder(path string) {
	_ = os.MkdirAll(path, 0o755)
	fixOwnership(path)
	_ = exec.Command("open", path).Start()
}

func permissionHint() string {
	return "Allow your terminal under System Settings > Privacy & Security > App Management, or run the installer with sudo"
}
