package project

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

var (
	// ErrNoTickTickFile is returned when no .ticktick file is found
	ErrNoTickTickFile = errors.New("no .ticktick file found in current directory or parent directories")
)

// FindTickTickFile searches for a .ticktick file starting from the given directory
// and walking up the directory tree until one is found or the root is reached
func FindTickTickFile(startDir string) (string, error) {
	// Make the path absolute
	absPath, err := filepath.Abs(startDir)
	if err != nil {
		return "", fmt.Errorf("failed to get absolute path: %w", err)
	}

	current := absPath

	// Walk up the directory tree
	for {
		ticktickPath := filepath.Join(current, TickTickFileName)

		// Check if .ticktick file exists
		if fileExists(ticktickPath) {
			return ticktickPath, nil
		}

		// Get parent directory
		parent := filepath.Dir(current)

		// If we've reached the root, stop
		if parent == current {
			return "", ErrNoTickTickFile
		}

		current = parent
	}
}

// FindProjectContext searches for and loads a project context starting from the given directory
func FindProjectContext(startDir string) (*ProjectContext, error) {
	ticktickPath, err := FindTickTickFile(startDir)
	if err != nil {
		return nil, err
	}

	ttFile, err := Load(ticktickPath)
	if err != nil {
		return nil, err
	}

	if err := ttFile.Validate(); err != nil {
		return nil, fmt.Errorf("invalid .ticktick file: %w", err)
	}

	return &ProjectContext{
		File:     ttFile,
		FilePath: ticktickPath,
	}, nil
}

// GetCurrentProjectContext tries to find a project context starting from the current working directory
func GetCurrentProjectContext() (*ProjectContext, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("failed to get current directory: %w", err)
	}

	return FindProjectContext(cwd)
}

// HasTickTickFile checks if a .ticktick file exists in the given directory
func HasTickTickFile(directory string) bool {
	ticktickPath := filepath.Join(directory, TickTickFileName)
	return fileExists(ticktickPath)
}

// fileExists checks if a file exists
func fileExists(path string) bool {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false
	}
	return err == nil && !info.IsDir()
}
