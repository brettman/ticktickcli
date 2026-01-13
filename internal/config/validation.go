package config

import (
	"fmt"
	"strings"
)

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.Version == "" {
		return fmt.Errorf("config version is required")
	}

	// Validate preferences
	if err := c.validatePreferences(); err != nil {
		return fmt.Errorf("invalid preferences: %w", err)
	}

	// Validate cache config
	if err := c.validateCache(); err != nil {
		return fmt.Errorf("invalid cache config: %w", err)
	}

	return nil
}

// validatePreferences validates preference values
func (c *Config) validatePreferences() error {
	// Validate date format (basic check)
	if c.Preferences.DateFormat == "" {
		return fmt.Errorf("date format cannot be empty")
	}

	// Validate time format
	validTimeFormats := []string{"12h", "24h"}
	if !contains(validTimeFormats, c.Preferences.TimeFormat) {
		return fmt.Errorf("time format must be one of: %s", strings.Join(validTimeFormats, ", "))
	}

	// Validate priority (0-5 range for TickTick)
	if c.Preferences.DefaultPriority < 0 || c.Preferences.DefaultPriority > 5 {
		return fmt.Errorf("default priority must be between 0 and 5")
	}

	return nil
}

// validateCache validates cache configuration
func (c *Config) validateCache() error {
	if c.Cache.Enabled && c.Cache.TTL <= 0 {
		return fmt.Errorf("cache TTL must be positive when cache is enabled")
	}
	return nil
}

// contains checks if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
