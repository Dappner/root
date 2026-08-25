// Package database provides helpers around the DB and connection etc
package database

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect configures db connections and connects
func Connect(databaseURL string) *pgxpool.Pool {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		slog.Error("failed to parse database URL", "err", err)
		os.Exit(1)
	}

	// Configure connection pool
	config.MaxConns = 25                       // Maximum connections in pool
	config.MinConns = 5                        // Keep warm connections ready
	config.MaxConnLifetime = 1 * time.Hour     // Recycle connections after 1 hour
	config.MaxConnIdleTime = 5 * time.Minute   // Close idle connections after 5 min
	config.HealthCheckPeriod = 1 * time.Minute // Periodic health checks

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		slog.Error("failed to create connection pool", "err", err)
		os.Exit(1)
	}

	if err := pool.Ping(context.Background()); err != nil {
		slog.Error("failed to connect to database", "err", err)
		os.Exit(1)
	}

	slog.Info("database connection pool initialized",
		"max_conns", config.MaxConns,
		"min_conns", config.MinConns)

	return pool
}
