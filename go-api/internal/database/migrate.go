package database

import (
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// RunMigrations runs all pending database migrations from the migrations directory.
// It uses golang-migrate to track and apply migrations in order.
// Returns nil if migrations succeed or if there are no new migrations to apply.
// If migrationsPath is empty, defaults to "migrations".
func RunMigrations(databaseURL string, migrationsPath ...string) error {
	path := "migrations"
	if len(migrationsPath) > 0 && migrationsPath[0] != "" {
		path = migrationsPath[0]
	}

	m, err := migrate.New(
		"file://"+path,
		databaseURL,
	)
	if err != nil {
		return fmt.Errorf("failed to create migration instance: %w", err)
	}
	defer m.Close()

	// Run all pending migrations
	if err := m.Up(); err != nil {
		if err == migrate.ErrNoChange {
			// No new migrations to apply is not an error
			return nil
		}
		return fmt.Errorf("migration failed: %w", err)
	}

	return nil
}
