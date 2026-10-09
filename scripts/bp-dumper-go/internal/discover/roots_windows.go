//go:build windows

package discover

import (
	"path/filepath"

	"golang.org/x/sys/windows"
)

// ExampleLIVEPath is shown in prompts as a sample LIVE folder.
const ExampleLIVEPath = DefaultWinPath + `\LIVE`

// scanRoots returns every fixed drive root (C:\, D:\, …).
func scanRoots() []string {
	var roots []string
	for c := 'A'; c <= 'Z'; c++ {
		root := string(c) + `:\`
		dt := windows.GetDriveType(windows.StringToUTF16Ptr(root))
		if dt == windows.DRIVE_FIXED {
			roots = append(roots, root)
		}
	}
	return roots
}

func defaultLIVE() string {
	return filepath.Join(DefaultWinPath, "LIVE")
}
