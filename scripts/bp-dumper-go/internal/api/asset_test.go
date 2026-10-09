package api

import (
	"runtime"
	"strings"
	"testing"
)

func TestAssetName(t *testing.T) {
	cases := []struct{ goos, goarch, want string }{
		{"windows", "amd64", "DumperApps.exe"},
		{"linux", "amd64", "DumperApps-linux-amd64"},
		{"linux", "arm64", "DumperApps-linux-arm64"},
	}
	for _, c := range cases {
		if got := assetName(c.goos, c.goarch); got != c.want {
			t.Errorf("assetName(%s, %s) = %q, want %q", c.goos, c.goarch, got, c.want)
		}
	}
}

func TestPlatformDownloadURL(t *testing.T) {
	got := PlatformDownloadURL("")
	if !strings.HasSuffix(got, "/"+AssetName()) {
		t.Fatalf("PlatformDownloadURL(\"\") = %q, want suffix %q", got, AssetName())
	}
	if runtime.GOOS != "windows" && strings.Contains(got, ".exe") {
		t.Fatalf("PlatformDownloadURL(\"\") = %q still points at the exe", got)
	}
}
