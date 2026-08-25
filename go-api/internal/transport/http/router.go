// Package http contains the minimal HTTP transport setup.
package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
)

// New builds the HTTP router. All business endpoints have been migrated to
// fast-api; go-api now only serves /health (plus runs migrations on startup).
func New() *chi.Mux {
	r := chi.NewRouter()

	// Base middleware
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("healthy\n"))
	})
	r.Head("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	return r
}
