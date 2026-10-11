/*
 * VampCord Installer
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Command VampCordInstaller installs VampCord into the Discord desktop app on Windows.
//
// Run it without arguments for an interactive menu, or use -install / -uninstall with -branch for scripting.
package main

import (
	"bufio"
	"embed"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// Files of the standalone desktop build, copied here by scripts/buildInstaller.mjs
//
//go:embed dist/*
var distFS embed.FS

var distFiles = []string{"patcher.js", "preload.js", "renderer.js", "renderer.css"}

type branch struct {
	key, name, folder, exe string
}

var branches = []branch{
	{"stable", "Discord Stable", "Discord", "Discord.exe"},
	{"ptb", "Discord PTB", "DiscordPTB", "DiscordPTB.exe"},
	{"canary", "Discord Canary", "DiscordCanary", "DiscordCanary.exe"},
	{"development", "Discord Development", "DiscordDevelopment", "DiscordDevelopment.exe"},
}

type install struct {
	branch
	// Discord's install folder, eg %LOCALAPPDATA%\Discord
	root string
	// resources folder of the newest app-x.y.z version
	resources string
}

func (i install) appAsar() string    { return filepath.Join(i.resources, "app.asar") }
func (i install) backupAsar() string { return filepath.Join(i.resources, "_app.asar") }

func (i install) isPatched() bool {
	_, err := os.Stat(i.backupAsar())
	return err == nil
}

func vampcordDir() string {
	return filepath.Join(os.Getenv("APPDATA"), "VampCord")
}

func distDir() string {
	return filepath.Join(vampcordDir(), "dist")
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

func findInstalls() []install {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return nil
	}

	var found []install
	for _, b := range branches {
		root := filepath.Join(localAppData, b.folder)
		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}

		var latest []int
		latestName := ""
		for _, e := range entries {
			if v, ok := parseVersion(e.Name()); ok && e.IsDir() && (latestName == "" || isNewer(v, latest)) {
				latest, latestName = v, e.Name()
			}
		}
		if latestName == "" {
			continue
		}

		resources := filepath.Join(root, latestName, "resources")
		inst := install{branch: b, root: root, resources: resources}
		if _, err := os.Stat(inst.appAsar()); err != nil && !inst.isPatched() {
			continue
		}
		found = append(found, inst)
	}
	return found
}

func killDiscord(inst install) {
	if runtime.GOOS != "windows" {
		return
	}
	// Discord keeps app.asar open while running, so it has to be closed before we can patch it
	if err := exec.Command("taskkill", "/F", "/IM", inst.exe).Run(); err == nil {
		fmt.Printf("  Closed %s\n", inst.name)
		time.Sleep(1500 * time.Millisecond)
	}
}

func startDiscord(inst install) {
	if runtime.GOOS != "windows" {
		return
	}
	updater := filepath.Join(inst.root, "Update.exe")
	if _, err := os.Stat(updater); err == nil {
		_ = exec.Command(updater, "--processStart", inst.exe).Start()
	}
}

// retry runs fn a few times, since Windows can keep a file locked for a moment after its process exits
func retry(fn func() error) (err error) {
	for attempt := 0; attempt < 10; attempt++ {
		if err = fn(); err == nil {
			return nil
		}
		time.Sleep(500 * time.Millisecond)
	}
	return err
}

func writeDist() error {
	dir := distDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	for _, name := range distFiles {
		data, err := distFS.ReadFile("dist/" + name)
		if err != nil {
			return fmt.Errorf("installer is missing %s: %w", name, err)
		}
		if err := retry(func() error { return os.WriteFile(filepath.Join(dir, name), data, 0o644) }); err != nil {
			return err
		}
	}
	return nil
}

func installTo(inst install) error {
	fmt.Printf("Installing VampCord into %s...\n", inst.name)
	killDiscord(inst)

	if err := writeDist(); err != nil {
		return fmt.Errorf("could not write VampCord files: %w", err)
	}

	if !inst.isPatched() {
		if err := retry(func() error { return os.Rename(inst.appAsar(), inst.backupAsar()) }); err != nil {
			return fmt.Errorf("could not back up Discord's app.asar (is Discord still running?): %w", err)
		}
	}

	stub, err := buildStubAsar(filepath.Join(distDir(), "patcher.js"))
	if err != nil {
		return err
	}
	if err := retry(func() error { return os.WriteFile(inst.appAsar(), stub, 0o644) }); err != nil {
		return fmt.Errorf("could not write app.asar: %w", err)
	}

	fmt.Printf("  Done! VampCord is installed into %s\n", inst.name)
	startDiscord(inst)
	return nil
}

func uninstallFrom(inst install) error {
	fmt.Printf("Uninstalling VampCord from %s...\n", inst.name)
	if !inst.isPatched() {
		fmt.Println("  VampCord is not installed there, nothing to do")
		return nil
	}

	killDiscord(inst)

	if err := retry(func() error {
		err := os.Remove(inst.appAsar())
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return err
	}); err != nil {
		return fmt.Errorf("could not remove app.asar: %w", err)
	}
	if err := retry(func() error { return os.Rename(inst.backupAsar(), inst.appAsar()) }); err != nil {
		return fmt.Errorf("could not restore Discord's app.asar: %w", err)
	}

	fmt.Printf("  Done! %s is back to normal\n", inst.name)
	startDiscord(inst)
	return nil
}

// cleanupDist removes the VampCord files once no Discord install uses them anymore. Settings and themes are kept
func cleanupDist() {
	for _, inst := range findInstalls() {
		if inst.isPatched() {
			return
		}
	}
	_ = os.RemoveAll(distDir())
}

func selectInstalls(installs []install, key string) ([]install, error) {
	if key == "all" {
		return installs, nil
	}
	for _, inst := range installs {
		if inst.key == key {
			return []install{inst}, nil
		}
	}
	return nil, fmt.Errorf("could not find %q. Installed: %s", key, installKeys(installs))
}

func installKeys(installs []install) string {
	keys := make([]string, len(installs))
	for i, inst := range installs {
		keys[i] = inst.key
	}
	return strings.Join(keys, ", ")
}

func run(installs []install, doInstall bool) (failed bool) {
	for _, inst := range installs {
		var err error
		if doInstall {
			err = installTo(inst)
		} else {
			err = uninstallFrom(inst)
		}
		if err != nil {
			fmt.Printf("  Error: %v\n", err)
			failed = true
		}
	}
	if !doInstall {
		cleanupDist()
	}
	return failed
}

func prompt(reader *bufio.Reader, text string) string {
	fmt.Print(text)
	line, _ := reader.ReadString('\n')
	return strings.TrimSpace(line)
}

func interactive() {
	reader := bufio.NewReader(os.Stdin)
	defer prompt(reader, "\nPress Enter to exit...")

	fmt.Println("==============================")
	fmt.Println("      VampCord Installer")
	fmt.Println("==============================")
	fmt.Println()

	installs := findInstalls()
	if len(installs) == 0 {
		fmt.Println("No Discord installation was found. Install Discord from https://discord.com/download and try again.")
		return
	}

	fmt.Println("Discord installations found:")
	for i, inst := range installs {
		status := "not installed"
		if inst.isPatched() {
			status = "VampCord installed"
		}
		fmt.Printf("  [%d] %s (%s)\n", i+1, inst.name, status)
	}
	fmt.Println()

	var targets []install
	if len(installs) == 1 {
		targets = installs
	} else {
		choice := prompt(reader, fmt.Sprintf("Which one? (1-%d, or A for all): ", len(installs)))
		if strings.EqualFold(choice, "a") {
			targets = installs
		} else if n, err := strconv.Atoi(choice); err == nil && n >= 1 && n <= len(installs) {
			targets = []install{installs[n-1]}
		} else {
			fmt.Println("Invalid choice")
			return
		}
	}

	fmt.Println()
	fmt.Println("  [1] Install / Repair VampCord")
	fmt.Println("  [2] Uninstall VampCord")
	fmt.Println("  [3] Exit")
	switch prompt(reader, "Choose an option: ") {
	case "1":
		fmt.Println()
		if !run(targets, true) {
			fmt.Println("\nAll done! Open Discord and look for the VampCord section in User Settings.")
		}
	case "2":
		fmt.Println()
		run(targets, false)
	}
}

func main() {
	doInstall := flag.Bool("install", false, "install VampCord without the interactive menu")
	doUninstall := flag.Bool("uninstall", false, "uninstall VampCord without the interactive menu")
	branchKey := flag.String("branch", "all", "Discord branch to use: stable, ptb, canary, development or all")
	flag.Parse()

	if runtime.GOOS != "windows" {
		fmt.Fprintln(os.Stderr, "Warning: this installer is meant for Windows")
	}

	if *doInstall == *doUninstall {
		if *doInstall {
			fmt.Fprintln(os.Stderr, "Use either -install or -uninstall, not both")
			os.Exit(2)
		}
		interactive()
		return
	}

	targets, err := selectInstalls(findInstalls(), strings.ToLower(*branchKey))
	if err == nil && len(targets) == 0 {
		err = errors.New("no Discord installation was found")
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "Error:", err)
		os.Exit(1)
	}

	if run(targets, *doInstall) {
		os.Exit(1)
	}
}
