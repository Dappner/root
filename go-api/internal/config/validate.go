package config

import (
	"errors"
	"fmt"
)

// Validate ensures required configuration is present and consistent.
func (c *Config) Validate() error {
	var errs []error

	if c.DatabaseURL == "" {
		errs = append(errs, fmt.Errorf("DATABASE_URL is required"))
	}
	if c.Port == "" {
		errs = append(errs, fmt.Errorf("PORT is required"))
	}

	return errors.Join(errs...)
}
