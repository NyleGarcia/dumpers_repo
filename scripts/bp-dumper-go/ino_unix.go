//go:build !windows

package main

import (
	"os"
	"syscall"
)

func getFileInode(fi os.FileInfo) uint64 {
	if sys, ok := fi.Sys().(*syscall.Stat_t); ok {
		return sys.Ino
	}
	return 0
}
