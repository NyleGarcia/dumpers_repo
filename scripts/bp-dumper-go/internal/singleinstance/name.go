package singleinstance

import "errors"

// MutexName is the Windows named mutex shared with dumper.py.
// Two DumperApps.exe, two scripts, or exe+script all take this same name.
const MutexName = `Local\DumpersRepo.BPDumper`

// ErrAlreadyRunning is returned when another BP Dumper already holds the lock.
var ErrAlreadyRunning = errors.New("already running")
