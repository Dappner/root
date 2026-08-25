package config

const (
	defaultEnvironment = "local"
	defaultPort        = "8080"
	defaultAutoMigrate = true
)

// EnvGetter abstracts environment lookup for easier testing.
type EnvGetter func(key string) string

// Config holds the minimal configuration for the go-api migration runner.
type Config struct {
	DatabaseURL string
	Port        string
	AutoMigrate bool
	Environment string
}

// IsDev returns true if the environment is dev or local
func (c *Config) IsDev() bool {
	return c.Environment == "dev" || c.Environment == "local"
}
