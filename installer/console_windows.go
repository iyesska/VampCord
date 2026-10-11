/*
 * VampCord Installer
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package main

import (
	"syscall"
	"unsafe"
)

const enableVirtualTerminalProcessing = 0x0004

// setupConsole sets the window title and enables ANSI colors. It reports whether colors are supported
func setupConsole(title string) bool {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")

	if titlePtr, err := syscall.UTF16PtrFromString(title); err == nil {
		_, _, _ = kernel32.NewProc("SetConsoleTitleW").Call(uintptr(unsafe.Pointer(titlePtr)))
	}

	handle, err := syscall.GetStdHandle(syscall.STD_OUTPUT_HANDLE)
	if err != nil {
		return false
	}

	var mode uint32
	if err := syscall.GetConsoleMode(handle, &mode); err != nil {
		return false
	}

	ret, _, _ := kernel32.NewProc("SetConsoleMode").Call(uintptr(handle), uintptr(mode|enableVirtualTerminalProcessing))
	return ret != 0
}
