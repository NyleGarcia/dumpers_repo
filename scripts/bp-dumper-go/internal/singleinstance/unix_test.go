//go:build unix

package singleinstance

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

func TestLockPathUsesXDGDataHome(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("XDG_DATA_HOME", dir)
	want := filepath.Join(dir, "dumper-apps", "instance.lock")
	if got := LockPath(); got != want {
		t.Fatalf("LockPath() = %q, want %q", got, want)
	}
}

func TestAcquireRejectsWhenLockHeld(t *testing.T) {
	t.Setenv("XDG_DATA_HOME", t.TempDir())
	path := LockPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	other, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0o644)
	if err != nil {
		t.Fatal(err)
	}
	defer other.Close()
	if err := syscall.Flock(int(other.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		t.Fatal(err)
	}
	if err := Acquire(); err != ErrAlreadyRunning {
		t.Fatalf("Acquire() = %v, want ErrAlreadyRunning", err)
	}
}
