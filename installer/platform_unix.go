//go:build linux || darwin

/*
 * VampCord Installer
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package main

import (
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"time"
)

// sudoUser is the user who ran `sudo VampCordInstaller`, since VampCord's files belong in their home, not root's
func sudoUser() *user.User {
	if os.Geteuid() != 0 {
		return nil
	}
	name := os.Getenv("SUDO_USER")
	if name == "" || name == "root" {
		return nil
	}
	u, err := user.Lookup(name)
	if err != nil {
		return nil
	}
	return u
}

func homeDir() string {
	if u := sudoUser(); u != nil {
		return u.HomeDir
	}
	home, _ := os.UserHomeDir()
	return home
}

// fixOwnership gives files created while running with sudo back to the real user
func fixOwnership(path string) {
	u := sudoUser()
	if u == nil {
		return
	}
	uid, err1 := strconv.Atoi(u.Uid)
	gid, err2 := strconv.Atoi(u.Gid)
	if err1 != nil || err2 != nil {
		return
	}
	_ = filepath.WalkDir(path, func(p string, _ fs.DirEntry, err error) error {
		if err == nil {
			_ = os.Lchown(p, uid, gid)
		}
		return nil
	})
}

type candidate struct {
	key, resources, process, launch string
}

func findFirst(candidates []candidate) []install {
	var found []install
	seen := map[string]bool{}
	for _, c := range candidates {
		if seen[c.key] {
			continue
		}
		resources, err := filepath.EvalSymlinks(c.resources)
		if err != nil {
			continue
		}
		inst := install{key: c.key, name: branchNames[c.key], resources: resources, process: c.process, launch: c.launch}
		if inst.isValid() {
			seen[c.key] = true
			found = append(found, inst)
		}
	}

	// Keep the usual stable, ptb, canary order
	ordered := make([]install, 0, len(found))
	for _, key := range branchOrder {
		for _, inst := range found {
			if inst.key == key {
				ordered = append(ordered, inst)
			}
		}
	}
	return ordered
}

func isRunning(inst install) bool {
	return exec.Command("pgrep", "-x", inst.process).Run() == nil
}

// closeDiscord closes Discord before patching it. It reports whether Discord was running
func closeDiscord(inst install) bool {
	if !isRunning(inst) {
		return false
	}

	fmt.Printf("  Closing %s...\n", inst.name)
	_ = exec.Command("pkill", "-x", inst.process).Run()
	for attempt := 0; attempt < 20 && isRunning(inst); attempt++ {
		time.Sleep(250 * time.Millisecond)
	}
	return true
}
