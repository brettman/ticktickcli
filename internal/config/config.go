package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const (
	// ConfigDirName is the directory name for config files
	ConfigDirName = ".ticktick"
	// ConfigFileName is the main config file name
	ConfigFileName = "config"
)

// Config represents the main configuration structure
type Config struct {
	Version     string      `json:"version"`
	Auth        AuthConfig  `json:"auth"`
	Preferences Preferences `json:"preferences"`
	Cache       CacheConfig `json:"cache"`
}

// AuthConfig holds authentication credentials
type AuthConfig struct {
	ClientID     string    `json:"clientId"`
	ClientSecret string    `json:"clientSecret"`
	AccessToken  string    `json:"accessToken"`
	RefreshToken string    `json:"refreshToken"`
	Expiry       time.Time `json:"expiry"`
}

// Preferences holds user preferences
type Preferences struct {
	DefaultProject string `json:"defaultProject,omitempty"`
	DateFormat     string `json:"dateFormat"`
	TimeFormat     string `json:"timeFormat"`
	DefaultPriority int   `json:"defaultPriority"`
	ColorOutput    bool   `json:"colorOutput"`
}

// CacheConfig holds cache settings
type CacheConfig struct {
	Enabled bool `json:"enabled"`
	TTL     int  `json:"ttl"` // in seconds
}

// DefaultConfig returns a new config with default values
func DefaultConfig() *Config {
	return &Config{
		Version: "1.0",
		Auth:    AuthConfig{},
		Preferences: Preferences{
			DateFormat:      "2006-01-02",
			TimeFormat:      "24h",
			DefaultPriority: 0,
			ColorOutput:     true,
		},
		Cache: CacheConfig{
			Enabled: true,
			TTL:     300, // 5 minutes
		},
	}
}

// GetConfigDir returns the path to the config directory
func GetConfigDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}
	return filepath.Join(home, ConfigDirName), nil
}

// GetConfigPath returns the full path to the config file
func GetConfigPath() (string, error) {
	dir, err := GetConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, ConfigFileName), nil
}

// Load loads the configuration from disk
func Load() (*Config, error) {
	configPath, err := GetConfigPath()
	if err != nil {
		return nil, err
	}

	// If config doesn't exist, return default config
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return DefaultConfig(), nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &config, nil
}

// Save saves the configuration to disk
func (c *Config) Save() error {
	configDir, err := GetConfigDir()
	if err != nil {
		return err
	}

	// Create config directory if it doesn't exist
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	configPath, err := GetConfigPath()
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(configPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// IsAuthenticated checks if the user has valid authentication credentials
func (c *Config) IsAuthenticated() bool {
	return c.Auth.AccessToken != ""
}

// IsTokenExpired checks if the access token is expired
func (c *Config) IsTokenExpired() bool {
	return time.Now().After(c.Auth.Expiry)
}

// UpdateAuth updates the authentication credentials
func (c *Config) UpdateAuth(clientID, clientSecret, accessToken, refreshToken string, expiry time.Time) error {
	c.Auth.ClientID = clientID
	c.Auth.ClientSecret = clientSecret
	c.Auth.AccessToken = accessToken
	c.Auth.RefreshToken = refreshToken
	c.Auth.Expiry = expiry
	return c.Save()
}

// ClearAuth clears the authentication credentials
func (c *Config) ClearAuth() error {
	c.Auth = AuthConfig{}
	return c.Save()
}

// SetPreference sets a preference value
func (c *Config) SetPreference(key, value string) error {
	switch key {
	case "defaultProject":
		c.Preferences.DefaultProject = value
	case "dateFormat":
		c.Preferences.DateFormat = value
	case "timeFormat":
		c.Preferences.TimeFormat = value
	case "colorOutput":
		c.Preferences.ColorOutput = value == "true"
	default:
		return fmt.Errorf("unknown preference key: %s", key)
	}
	return c.Save()
}

// GetPreference gets a preference value
func (c *Config) GetPreference(key string) (string, error) {
	switch key {
	case "defaultProject":
		return c.Preferences.DefaultProject, nil
	case "dateFormat":
		return c.Preferences.DateFormat, nil
	case "timeFormat":
		return c.Preferences.TimeFormat, nil
	case "colorOutput":
		if c.Preferences.ColorOutput {
			return "true", nil
		}
		return "false", nil
	default:
		return "", fmt.Errorf("unknown preference key: %s", key)
	}
}
