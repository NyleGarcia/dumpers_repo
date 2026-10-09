//go:build !windows && !unix

package singleinstance

// Acquire is a no-op where neither a Windows mutex nor flock is available.
func Acquire() error { return nil }
