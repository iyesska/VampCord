/*
 * VampCord Installer
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"strconv"
)

type asarFile struct {
	name string
	data []byte
}

// buildAsar creates a flat asar archive (no sub directories) containing the given files.
//
// Layout: [uint32 4][uint32 headerPickleSize] then the header pickle
// [uint32 payloadSize][uint32 jsonLength][json, padded to 4 bytes], followed by the file contents
func buildAsar(files []asarFile) ([]byte, error) {
	type entry struct {
		Size   int    `json:"size"`
		Offset string `json:"offset"`
	}

	entries := make(map[string]entry, len(files))
	offset := 0
	for _, f := range files {
		entries[f.name] = entry{Size: len(f.data), Offset: strconv.Itoa(offset)}
		offset += len(f.data)
	}

	header, err := json.Marshal(map[string]any{"files": entries})
	if err != nil {
		return nil, err
	}

	padding := (4 - len(header)%4) % 4
	headerPickleSize := 8 + len(header) + padding

	var buf bytes.Buffer
	for _, n := range []int{4, headerPickleSize, headerPickleSize - 4, len(header)} {
		_ = binary.Write(&buf, binary.LittleEndian, uint32(n))
	}
	buf.Write(header)
	buf.Write(make([]byte, padding))

	for _, f := range files {
		buf.Write(f.data)
	}

	return buf.Bytes(), nil
}

// buildStubAsar creates the app.asar that Discord loads instead of its own, which simply requires the VampCord patcher.
// The patcher then loads Discord's original app from _app.asar
func buildStubAsar(patcherPath string) ([]byte, error) {
	quotedPath, err := json.Marshal(patcherPath)
	if err != nil {
		return nil, err
	}

	return buildAsar([]asarFile{
		{name: "index.js", data: []byte("require(" + string(quotedPath) + ");\n")},
		{name: "package.json", data: []byte(`{"name":"discord","main":"index.js"}` + "\n")},
	})
}
