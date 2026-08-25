// Command server runs the go-api migration runner: it applies pending database
// migrations on startup (golang-migrate) and serves a minimal /health endpoint.
// All business endpoints live in fast-api.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"github.com/dappner/root/internal/app"
	"github.com/dappner/root/internal/config"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(runHealthcheck())
	}

	loadDotEnv()

	cfg := config.Load()
	logger := setupLogger(cfg)

	if err := cfg.Validate(); err != nil {
		logger.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	logger.Info("configuration loaded", "environment", cfg.Environment)

	if err := app.RunServer(context.Background(), cfg); err != nil {
		logger.Error("application stopped", "error", err)
		os.Exit(1)
	}
}

func runHealthcheck() int {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	client := http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/health")
	if err != nil {
		return 1
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 1
	}
	return 0
}

func loadDotEnv() {
	// Load .env file from parent directory (project root) if it exists.
	if err := godotenv.Load("../.env"); err != nil && !os.IsNotExist(err) {
		slog.Warn("failed to load .env", "error", err)
	}
}

func setupLogger(cfg *config.Config) *slog.Logger {
	opts := &slog.HandlerOptions{AddSource: true}

	var handler slog.Handler
	if strings.EqualFold(strings.TrimSpace(cfg.Environment), "localhost") {
		handler = slog.NewTextHandler(os.Stdout, opts)
	} else {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	}

	logger := slog.New(handler)
	slog.SetDefault(logger)
	return logger
}
