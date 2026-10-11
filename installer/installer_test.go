/*
 * VampCord Installer
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package main

import (
	"encoding/binary"
	"encoding/json"
	"strconv"
	"testing"
)

func TestParseVersion(t *testing.T) {
	newer, _ := parseVersion("app-1.0.9187")
	older, _ := parseVersion("app-1.0.10")
	if !isNewer(newer, older) || isNewer(older, newer) {
		t.Fatal("app-1.0.9187 should be newer than app-1.0.10")
	}
	for _, name := range []string{"packages", "app-", "app-1.x", "Update.exe"} {
		if _, ok := parseVersion(name); ok {
			t.Errorf("%q should not parse as a version", name)
		}
	}
}

func TestBuildAsar(t *testing.T) {
	files := []asarFile{{"index.js", []byte("hello")}, {"package.json", []byte("{}")}}
	archive, err := buildAsar(files)
	if err != nil {
		t.Fatal(err)
	}

	headerPickleSize := binary.LittleEndian.Uint32(archive[4:8])
	jsonLen := binary.LittleEndian.Uint32(archive[12:16])
	if headerPickleSize%4 != 0 {
		t.Fatalf("header pickle size %d is not 4 byte aligned", headerPickleSize)
	}

	var header struct {
		Files map[string]struct {
			Size   int    `json:"size"`
			Offset string `json:"offset"`
		} `json:"files"`
	}
	if err := json.Unmarshal(archive[16:16+jsonLen], &header); err != nil {
		t.Fatal(err)
	}

	base := 8 + int(headerPickleSize)
	for _, f := range files {
		entry := header.Files[f.name]
		offset, _ := strconv.Atoi(entry.Offset)
		if got := string(archive[base+offset : base+offset+entry.Size]); got != string(f.data) {
			t.Errorf("%s: got %q, want %q", f.name, got, f.data)
		}
	}
}
