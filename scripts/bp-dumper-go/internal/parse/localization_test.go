package parse

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseLocalLocalizationCapitalDataDir(t *testing.T) {
	channel := t.TempDir()
	dir := filepath.Join(channel, "Data", "Localization", "english")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	ini := "item_Name_Sample_Blueprint=Sample Blueprint\n"
	if err := os.WriteFile(filepath.Join(dir, "global.ini"), []byte(ini), 0o644); err != nil {
		t.Fatal(err)
	}
	got := ParseLocalLocalization(channel)
	if len(got["sample blueprint"]) == 0 {
		t.Fatalf("ParseLocalLocalization(Data/…) = %v, want entry for \"sample blueprint\"", got)
	}
}
