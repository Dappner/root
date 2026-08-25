// Package app provides application-level wiring and lifecycle management
package app

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dappner/root/internal/config"
	appHttp "github.com/dappner/root/internal/transport/http"
)

// App holds all application dependencies and provides lifecycle management
type App struct {
	cfg        *config.Config
	dbPool     *pgxpool.Pool
	httpServer *http.Server
}

// New creates and wires up the entire application
func New(cfg *config.Config, dbPool *pgxpool.Pool) (*App, error) {
	app := &App{
		cfg:    cfg,
		dbPool: dbPool,
	}

	// Setup HTTP server (business endpoints now live in fast-api; go-api only
	// runs migrations on startup and serves /health).
	router := appHttp.New()
	app.httpServer = &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	return app, nil
}

// Run starts all application components
func (a *App) Run(ctx context.Context) error {
	slog.Info("starting http server", "addr", a.httpServer.Addr)
	return a.httpServer.ListenAndServe()
}

// Shutdown gracefully stops all application components
func (a *App) Shutdown(ctx context.Context) error {
	slog.Info("shutting down application")

	if a.httpServer != nil {
		slog.Info("stopping http server")
		if err := a.httpServer.Shutdown(ctx); err != nil {
			slog.Error("error stopping http server", "error", err)
			return err
		}
	}

	if a.dbPool != nil {
		a.dbPool.Close()
	}

	return nil
}
