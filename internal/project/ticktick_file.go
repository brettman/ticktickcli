package project

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const (
	// TickTickFileName is the name of the .ticktick file
	TickTickFileName = ".ticktick"
	// CurrentVersion is the current .ticktick file format version
	CurrentVersion = "1.0"
)

// NewTickTickFile creates a new TickTickFile
func NewTickTickFile(projectID, projectName, folderPath string) *TickTickFile {
	now := time.Now()
	return &TickTickFile{
		Version:     CurrentVersion,
		ProjectID:   projectID,
		ProjectName: projectName,
		FolderPath:  folderPath,
		CreatedAt:   now,
		SyncedAt:    now,
	}
}

// Load reads a .ticktick file from the given path
func Load(filePath string) (*TickTickFile, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read .ticktick file: %w", err)
	}

	var ttFile TickTickFile
	if err := json.Unmarshal(data, &ttFile); err != nil {
		return nil, fmt.Errorf("failed to parse .ticktick file: %w", err)
	}

	return &ttFile, nil
}

// Save writes the TickTickFile to the specified directory
func (t *TickTickFile) Save(directory string) error {
	// Ensure the directory exists
	if err := os.MkdirAll(directory, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	filePath := filepath.Join(directory, TickTickFileName)

	data, err := json.MarshalIndent(t, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal .ticktick file: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write .ticktick file: %w", err)
	}

	return nil
}

// UpdateSyncTime updates the SyncedAt timestamp
func (t *TickTickFile) UpdateSyncTime() {
	t.SyncedAt = time.Now()
}

// Validate validates the TickTickFile structure
func (t *TickTickFile) Validate() error {
	if t.Version == "" {
		return fmt.Errorf("version is required")
	}
	if t.ProjectID == "" {
		return fmt.Errorf("projectId is required")
	}
	if t.ProjectName == "" {
		return fmt.Errorf("projectName is required")
	}
	if t.FolderPath == "" {
		return fmt.Errorf("folderPath is required")
	}
	return nil
}

// LoadProjectContext loads the project context from a directory
func LoadProjectContext(directory string) (*ProjectContext, error) {
	filePath := filepath.Join(directory, TickTickFileName)

	ttFile, err := Load(filePath)
	if err != nil {
		return nil, err
	}

	if err := ttFile.Validate(); err != nil {
		return nil, fmt.Errorf("invalid .ticktick file: %w", err)
	}

	return &ProjectContext{
		File:     ttFile,
		FilePath: filePath,
	}, nil
}

// SaveProjectContext saves the project context
func SaveProjectContext(ctx *ProjectContext) error {
	directory := filepath.Dir(ctx.FilePath)
	return ctx.File.Save(directory)
}
