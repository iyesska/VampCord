/*
 * VampCord Installer
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

var windowsFolders = map[string]string{
	"stable":      "Discord",
	"ptb":         "DiscordPTB",
	"canary":      "DiscordCanary",
	"development": "DiscordDevelopment",
}

func configDir() string {
	return os.Getenv("APPDATA")
}

// Folders Discord can be installed in: per user (the default) and the machine wide installer's %ProgramData%\<user>
func searchRoots() []string {
	var roots []string
	if dir := os.Getenv("LOCALAPPDATA"); dir != "" {
		roots = append(roots, dir)
	}
	if programData, user := os.Getenv("ProgramData"), os.Getenv("USERNAME"); programData != "" && user != "" {
		roots = append(roots, filepath.Join(programData, user))
	}
	return roots
}

// findInstallIn looks for the newest app-x.y.z version in a Discord folder like %LOCALAPPDATA%\Discord
func findInstallIn(root, key string) (install, bool) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return install{}, false
	}

	var latest []int
	latestName := ""
	for _, e := range entries {
		if v, ok := parseVersion(e.Name()); ok && e.IsDir() && (latestName == "" || isNewer(v, latest)) {
			latest, latestName = v, e.Name()
		}
	}
	if latestName == "" {
		return install{}, false
	}

	inst := install{
		key:       key,
		name:      branchNames[key],
		resources: filepath.Join(root, latestName, "resources"),
		version:   strings.TrimPrefix(latestName, "app-"),
		process:   windowsFolders[key] + ".exe",
		launch:    root,
	}
	return inst, inst.isValid()
}

func findInstalls() []install {
	var found []install
	for _, key := range branchOrder {
		for _, base := range searchRoots() {
			if inst, ok := findInstallIn(filepath.Join(base, windowsFolders[key]), key); ok {
				found = append(found, inst)
				break
			}
		}
	}
	return found
}

func isRunning(inst install) bool {
	out, err := exec.Command("tasklist", "/FI", "IMAGENAME eq "+inst.process, "/NH").Output()
	return err == nil && bytes.Contains(bytes.ToLower(out), []byte(strings.ToLower(inst.process)))
}

// closeDiscord closes Discord since it keeps app.asar open while running. It reports whether Discord was running
func closeDiscord(inst install) bool {
	if !isRunning(inst) {
		return false
	}

	fmt.Printf("  Closing %s...\n", inst.name)
	_ = exec.Command("taskkill", "/F", "/T", "/IM", inst.process).Run()

	for attempt := 0; attempt < 20 && isRunning(inst); attempt++ {
		time.Sleep(250 * time.Millisecond)
	}
	// Give Windows a moment to release file handles
	time.Sleep(500 * time.Millisecond)
	return true
}

func startDiscord(inst install) {
	updater := filepath.Join(inst.launch, "Update.exe")
	if _, err := os.Stat(updater); err == nil {
		fmt.Printf("  Starting %s...\n", inst.name)
		_ = exec.Command(updater, "--processStart", inst.process).Start()
	}
}

func openFolder(path string) {
	_ = os.MkdirAll(path, 0o755)
	_ = exec.Command("explorer", path).Start()
}

// Files in the user's own folders never need fixing on Windows
func fixOwnership(string) {}

func permissionHint() string {
	return "Close Discord completely (also from the system tray) and try again"
}
