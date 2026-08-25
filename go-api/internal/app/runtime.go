package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dappner/root/internal/config"
	"github.com/dappner/root/internal/database"
)

// RunServer bootstraps the application, runs pending migrations, and starts the
// minimal HTTP server. It manages graceful shutdown triggered by context
// cancellation or OS signals.
func RunServer(parentCtx context.Context, cfg *config.Config) error {
	ctx, stop := signal.NotifyContext(parentCtx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Run migrations if AUTO_MIGRATE is enabled
	if cfg.AutoMigrate {
		slog.Info("running database migrations", "path", "migrations")
		if err := database.RunMigrations(cfg.DatabaseURL); err != nil {
			return fmt.Errorf("failed to run migrations: %w", err)
		}
		slog.Info("database migrations completed successfully")
	}

	dbPool := database.Connect(cfg.DatabaseURL)

	application, err := New(cfg, dbPool)
	if err != nil {
		dbPool.Close()
		return fmt.Errorf("initialize application: %w", err)
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- application.Run(ctx)
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := application.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown application: %w", err)
		}

		runErr := <-errCh
		if runErr == nil || errors.Is(runErr, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("server stopped with error: %w", runErr)
	case runErr := <-errCh:
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := application.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown application: %w", err)
		}
		if runErr == nil || errors.Is(runErr, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("server stopped with error: %w", runErr)
	}
}
