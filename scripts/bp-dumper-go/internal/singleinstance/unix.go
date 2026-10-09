//go:build unix

package singleinstance

import (
	"errors"
	"os"
	"path/filepath"
	"syscall"
)

var held *os.File

// LockPath is the flock file shared with dumper.py on Linux/macOS:
// $XDG_DATA_HOME/dumper-apps/instance.lock (default ~/.local/share).
func LockPath() string {
	base := os.Getenv("XDG_DATA_HOME")
	if base == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		base = filepath.Join(home, ".local", "share")
	}
	return filepath.Join(base, "dumper-apps", "instance.lock")
}

// Acquire takes a process-lifetime exclusive flock. Lock setup failures do not
// block startup. The file stays open until process exit.
func Acquire() error {
	path := LockPath()
	if path == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil
	}
	f, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0o644)
	if err != nil {
		return nil
	}
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		_ = f.Close()
		if errors.Is(err, syscall.EWOULDBLOCK) {
			return ErrAlreadyRunning
		}
		return nil
	}
	held = f
	return nil
}
