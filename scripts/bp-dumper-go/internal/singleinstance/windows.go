//go:build windows

package singleinstance

import (
	"golang.org/x/sys/windows"
)

var held windows.Handle

// Acquire takes the process-lifetime Windows mutex. A failed CreateMutex does
// not block startup. The handle is kept until process exit.
func Acquire() error {
	name, err := windows.UTF16PtrFromString(MutexName)
	if err != nil {
		return nil
	}
	h, err := windows.CreateMutex(nil, false, name)
	if err == windows.ERROR_ALREADY_EXISTS {
		if h != 0 {
			_ = windows.CloseHandle(h)
		}
		return ErrAlreadyRunning
	}
	if err != nil {
		return nil
	}
	held = h
	return nil
}
