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
	"bytes"
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

// Set at build time by scripts/buildInstaller.mjs
var (
	version = "dev"
	commit  = "unknown"
)

// Files of the standalone desktop build, copied here by scripts/buildInstaller.mjs
//
//go:embed dist/*
var distFS embed.FS

var distFiles = []string{"patcher.js", "preload.js", "renderer.js", "renderer.css"}

var useColor bool

func paint(code, s string) string {
	if !useColor {
		return s
	}
	return "\x1b[" + code + "m" + s + "\x1b[0m"
}

func red(s string) string    { return paint("1;31", s) }
func green(s string) string  { return paint("1;32", s) }
func yellow(s string) string { return paint("1;33", s) }
func dim(s string) string    { return paint("2", s) }
func bold(s string) string   { return paint("1", s) }

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
	// app-x.y.z folder name
	version string
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

// Settings, QuickCSS and themes live here (the folder name is kept for compatibility with Vencord)
func settingsDir() string {
	return filepath.Join(os.Getenv("APPDATA"), "Vencord")
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

func findInstall(root string, b branch) (install, bool) {
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
		branch:    b,
		root:      root,
		resources: filepath.Join(root, latestName, "resources"),
		version:   strings.TrimPrefix(latestName, "app-"),
	}
	if _, err := os.Stat(inst.appAsar()); err != nil && !inst.isPatched() {
		return install{}, false
	}
	return inst, true
}

func findInstalls() []install {
	var found []install
	for _, b := range branches {
		for _, base := range searchRoots() {
			if inst, ok := findInstall(filepath.Join(base, b.folder), b); ok {
				found = append(found, inst)
				break
			}
		}
	}
	return found
}

func isRunning(inst install) bool {
	if runtime.GOOS != "windows" {
		return false
	}
	out, err := exec.Command("tasklist", "/FI", "IMAGENAME eq "+inst.exe, "/NH").Output()
	return err == nil && bytes.Contains(bytes.ToLower(out), []byte(strings.ToLower(inst.exe)))
}

// closeDiscord closes Discord since it keeps app.asar open while running. It reports whether Discord was running
func closeDiscord(inst install) bool {
	if !isRunning(inst) {
		return false
	}

	fmt.Printf("  Closing %s...\n", inst.name)
	_ = exec.Command("taskkill", "/F", "/T", "/IM", inst.exe).Run()

	for attempt := 0; attempt < 20 && isRunning(inst); attempt++ {
		time.Sleep(250 * time.Millisecond)
	}
	// Give Windows a moment to release file handles
	time.Sleep(500 * time.Millisecond)
	return true
}

func startDiscord(inst install) {
	if runtime.GOOS != "windows" {
		return
	}
	updater := filepath.Join(inst.root, "Update.exe")
	if _, err := os.Stat(updater); err == nil {
		fmt.Printf("  Starting %s...\n", inst.name)
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
			return fmt.Errorf("the installer is missing %s: %w", name, err)
		}
		if err := retry(func() error { return os.WriteFile(filepath.Join(dir, name), data, 0o644) }); err != nil {
			return err
		}
	}
	return nil
}

// verifyInstall checks that the files Discord will load are really there
func verifyInstall(inst install, stub []byte) error {
	written, err := os.ReadFile(inst.appAsar())
	if err != nil || !bytes.Equal(written, stub) {
		return errors.New("app.asar was not written correctly")
	}
	if _, err := os.Stat(inst.backupAsar()); err != nil {
		return errors.New("the backup of Discord's app.asar is missing")
	}
	for _, name := range distFiles {
		if fi, err := os.Stat(filepath.Join(distDir(), name)); err != nil || fi.Size() == 0 {
			return fmt.Errorf("%s was not written correctly", name)
		}
	}
	return nil
}

func installTo(inst install) error {
	fmt.Printf("%s %s\n", bold("Installing VampCord into"), bold(inst.name))
	wasRunning := closeDiscord(inst)

	fmt.Println("  Copying VampCord files...")
	if err := writeDist(); err != nil {
		return fmt.Errorf("could not write the VampCord files: %w", err)
	}

	if !inst.isPatched() {
		fmt.Println("  Backing up Discord's app.asar...")
		if err := retry(func() error { return os.Rename(inst.appAsar(), inst.backupAsar()) }); err != nil {
			return fmt.Errorf("could not back up Discord's app.asar. Close Discord completely (also from the system tray) and try again: %w", err)
		}
	}

	stub, err := buildStubAsar(filepath.Join(distDir(), "patcher.js"))
	if err != nil {
		return err
	}
	fmt.Println("  Patching Discord...")
	if err := retry(func() error { return os.WriteFile(inst.appAsar(), stub, 0o644) }); err != nil {
		return fmt.Errorf("could not write app.asar: %w", err)
	}

	if err := verifyInstall(inst, stub); err != nil {
		return fmt.Errorf("verification failed: %w. Try running the installer again", err)
	}

	fmt.Println(green("  ✓ VampCord was installed into " + inst.name))
	if wasRunning || interactiveMode {
		startDiscord(inst)
	}
	return nil
}

func uninstallFrom(inst install) error {
	fmt.Printf("%s %s\n", bold("Uninstalling VampCord from"), bold(inst.name))
	if !inst.isPatched() {
		fmt.Println(dim("  VampCord is not installed there, nothing to do"))
		return nil
	}

	wasRunning := closeDiscord(inst)

	fmt.Println("  Restoring Discord's app.asar...")
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

	fmt.Println(green("  ✓ " + inst.name + " is back to normal"))
	if wasRunning || interactiveMode {
		startDiscord(inst)
	}
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
	for i, inst := range installs {
		if i > 0 {
			fmt.Println()
		}
		var err error
		if doInstall {
			err = installTo(inst)
		} else {
			err = uninstallFrom(inst)
		}
		if err != nil {
			fmt.Println(red("  ✗ Error: ") + err.Error())
			failed = true
		}
	}
	if !doInstall {
		cleanupDist()
	}
	return failed
}

var interactiveMode bool

func prompt(reader *bufio.Reader, text string) string {
	fmt.Print(text)
	line, _ := reader.ReadString('\n')
	return strings.TrimSpace(line)
}

func openFolder(path string) {
	_ = os.MkdirAll(path, 0o755)
	if runtime.GOOS == "windows" {
		_ = exec.Command("explorer", path).Start()
	} else {
		fmt.Println("  " + path)
	}
}

func printBanner() {
	fmt.Println(red(`
 __     __                       ____              _
 \ \   / /_ _ _ __ ___  _ __    / ___|___  _ __ __| |
  \ \ / / _' | '_ ' _ \| '_ \  | |   / _ \| '__/ _' |
   \ V / (_| | | | | | | |_) | | |__| (_) | | | (_| |
    \_/ \__,_|_| |_| |_| .__/   \____\___/|_|  \__,_|
                       |_|`))
	fmt.Println(dim(fmt.Sprintf("  Installer v%s (%s)", version, commit)))
	fmt.Println()
}

func interactive() {
	interactiveMode = true
	reader := bufio.NewReader(os.Stdin)
	defer prompt(reader, dim("\nPress Enter to exit..."))

	printBanner()

	installs := findInstalls()
	if len(installs) == 0 {
		fmt.Println(red("No Discord installation was found."))
		fmt.Println("Install Discord from https://discord.com/download, open it once and run this installer again.")
		return
	}

	fmt.Println(bold("Discord installations found:"))
	for i, inst := range installs {
		status := dim("VampCord not installed")
		if inst.isPatched() {
			status = green("VampCord installed")
		}
		fmt.Printf("  [%d] %s %s  %s\n", i+1, inst.name, dim("v"+inst.version), status)
	}
	fmt.Println()

	var targets []install
	if len(installs) == 1 {
		targets = installs
	} else {
		for targets == nil {
			choice := prompt(reader, fmt.Sprintf("Which one? (1-%d, or A for all): ", len(installs)))
			if strings.EqualFold(choice, "a") {
				targets = installs
			} else if n, err := strconv.Atoi(choice); err == nil && n >= 1 && n <= len(installs) {
				targets = []install{installs[n-1]}
			} else {
				fmt.Println(yellow("Please type a number from the list or A"))
			}
		}
	}

	for {
		fmt.Println()
		fmt.Println("  [1] Install / Repair VampCord")
		fmt.Println("  [2] Uninstall VampCord")
		fmt.Println("  [3] Open the themes & settings folder")
		fmt.Println("  [4] Exit")
		fmt.Println()

		switch prompt(reader, "Choose an option: ") {
		case "1":
			fmt.Println()
			if !run(targets, true) {
				fmt.Println()
				fmt.Println(green("All done!") + " Discord will open with a new " + bold("VampCord") + " section in User Settings.")
			}
			return
		case "2":
			fmt.Println()
			if !run(targets, false) {
				fmt.Println()
				fmt.Println(green("All done!") + " Your VampCord settings and themes were kept in " + settingsDir())
			}
			return
		case "3":
			openFolder(settingsDir())
		case "4", "":
			return
		default:
			fmt.Println(yellow("Please choose 1, 2, 3 or 4"))
		}
	}
}

func main() {
	doInstall := flag.Bool("install", false, "install VampCord without the interactive menu")
	doUninstall := flag.Bool("uninstall", false, "uninstall VampCord without the interactive menu")
	branchKey := flag.String("branch", "all", "Discord branch to use: stable, ptb, canary, development or all")
	showVersion := flag.Bool("version", false, "print the installer version")
	flag.Parse()

	useColor = setupConsole("VampCord Installer") && os.Getenv("NO_COLOR") == ""

	if *showVersion {
		fmt.Printf("VampCord Installer %s (%s)\n", version, commit)
		return
	}

	if runtime.GOOS != "windows" {
		fmt.Fprintln(os.Stderr, yellow("Warning: this installer is meant for Windows"))
	}

	if *doInstall && *doUninstall {
		fmt.Fprintln(os.Stderr, "Use either -install or -uninstall, not both")
		os.Exit(2)
	}
	if !*doInstall && !*doUninstall {
		interactive()
		return
	}

	targets, err := selectInstalls(findInstalls(), strings.ToLower(*branchKey))
	if err == nil && len(targets) == 0 {
		err = errors.New("no Discord installation was found")
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, red("Error: ")+err.Error())
		os.Exit(1)
	}

	if run(targets, *doInstall) {
		os.Exit(1)
	}
}
