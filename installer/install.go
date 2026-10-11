/*
 * VampCord Installer
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package main

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// install is a Discord installation found on this computer
type install struct {
	// stable, ptb, canary or development
	key string
	// Human readable name, eg "Discord Stable"
	name string
	// Folder containing Discord's app.asar
	resources string
	// Discord version, if known
	version string
	// Name of Discord's process, used to close it before patching
	process string
	// Platform specific info needed to start Discord again
	launch string
}

func (i install) appAsar() string    { return filepath.Join(i.resources, "app.asar") }
func (i install) backupAsar() string { return filepath.Join(i.resources, "_app.asar") }

func (i install) isPatched() bool {
	_, err := os.Stat(i.backupAsar())
	return err == nil
}

// isValid reports whether resources really is a Discord resources folder
func (i install) isValid() bool {
	if i.isPatched() {
		return true
	}
	fi, err := os.Stat(i.appAsar())
	return err == nil && !fi.IsDir()
}

var branchNames = map[string]string{
	"stable":      "Discord Stable",
	"ptb":         "Discord PTB",
	"canary":      "Discord Canary",
	"development": "Discord Development",
}

var branchOrder = []string{"stable", "ptb", "canary", "development"}

// distOverride is set by -dist to use an existing build folder (eg the repository's dist for `pnpm inject`)
// instead of copying the files bundled with the installer
var distOverride string

// vampcordDir is VampCord's data folder: settings, themes and the installed files. It matches the folder
// VampCord itself uses, which is next to Discord's own data folder
func vampcordDir() string {
	return filepath.Join(configDir(), "VampCord")
}

func distDir() string {
	if distOverride != "" {
		return distOverride
	}
	return filepath.Join(vampcordDir(), "dist")
}

func settingsDir() string {
	return vampcordDir()
}

// parseVersion turns "app-1.0.9187" into [1 0 9187]. ok is false for folders that aren't app versions
func parseVersion(name string) (parts []int, ok bool) {
	if !strings.HasPrefix(name, "app-") {
		return nil, false
	}
	for _, s := range strings.Split(strings.TrimPrefix(name, "app-"), ".") {
		n, err := strconv.Atoi(s)
		if err != nil {
			return nil, false
		}
		parts = append(parts, n)
	}
	return parts, true
}

func isNewer(a, b []int) bool {
	for i := 0; i < len(a) && i < len(b); i++ {
		if a[i] != b[i] {
			return a[i] > b[i]
		}
	}
	return len(a) > len(b)
}
