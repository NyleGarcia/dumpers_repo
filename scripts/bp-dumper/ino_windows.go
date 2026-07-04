//go:build windows

package main

import "os"

func getFileInode(fi os.FileInfo) uint64 {
	return 0
}
