package project

import "time"

// TickTickFile represents the .ticktick file structure
type TickTickFile struct {
	Version     string    `json:"version"`
	ProjectID   string    `json:"projectId"`
	ProjectName string    `json:"projectName"`
	FolderPath  string    `json:"folderPath"`
	CreatedAt   time.Time `json:"createdAt"`
	SyncedAt    time.Time `json:"syncedAt"`
}

// ProjectContext holds the current project context
type ProjectContext struct {
	File     *TickTickFile
	FilePath string
}
