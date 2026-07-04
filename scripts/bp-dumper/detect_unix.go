//go:build !windows

package main

func detectSCInstalls() map[string]string {
	return make(map[string]string)
}

func enableWindowsANSI() {}
