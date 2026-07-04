//go:build windows

package main

import (
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

func detectSCInstalls() map[string]string {
	found := make(map[string]string)
	driveFixed := uint32(3)
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	getDriveType := kernel32.NewProc("GetDriveTypeW")

	for _, letter := range "ABCDEFGHIJKLMNOPQRSTUVWXYZ" {
		driveRoot := string(letter) + ":\\"
		utf16Ptr, err := syscall.UTF16PtrFromString(driveRoot)
		if err != nil {
			continue
		}
		ret, _, _ := getDriveType.Call(uintptr(unsafe.Pointer(utf16Ptr)))
		if uint32(ret) != driveFixed {
			continue
		}

		roots := findSCRoots(driveRoot)
		for _, scRoot := range roots {
			entries, err := os.ReadDir(scRoot)
			if err != nil {
				continue
			}
			for _, entry := range entries {
				if !entry.IsDir() {
					continue
				}
				channelDir := filepath.Join(scRoot, entry.Name())
				if isChannelDir(channelDir) {
					channel := strings.ToUpper(entry.Name())
					if _, exists := found[channel]; !exists {
						found[channel] = channelDir
					}
				}
			}
		}
	}
	return found
}

func enableWindowsANSI() {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	setConsoleMode := kernel32.NewProc("SetConsoleMode")
	getStdHandle := kernel32.NewProc("GetStdHandle")
	stdoutHandle, _, _ := getStdHandle.Call(uintptr(0xFFFFFFF5)) // -11 (STD_OUTPUT_HANDLE)
	if stdoutHandle != 0 {
		setConsoleMode.Call(stdoutHandle, uintptr(7))
	}
}
