package config

import (
	"os"
	"strconv"
	"strings"
)

// Load reads configuration from environment variables
func Load() *Config {
	return LoadFrom(os.Getenv)
}

// LoadFrom reads configuration using the provided getter
func LoadFrom(get EnvGetter) *Config {
	if get == nil {
		get = os.Getenv
	}

	return &Config{
		DatabaseURL: get("DATABASE_URL"),
		Port:        getOrDefault(get, "PORT", defaultPort),
		AutoMigrate: parseBoolDefault(get("AUTO_MIGRATE"), defaultAutoMigrate),
		Environment: getOrDefault(get, "APP_ENV", defaultEnvironment),
	}
}

func getOrDefault(get EnvGetter, key, defaultValue string) string {
	if value := get(key); value != "" {
		return value
	}
	return defaultValue
}

func parseBoolDefault(value string, defaultValue bool) bool {
	if value == "" {
		return defaultValue
	}

	b, err := strconv.ParseBool(strings.TrimSpace(value))
	if err != nil {
		return defaultValue
	}

	return b
}
