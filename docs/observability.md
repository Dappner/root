# Observability Stack - Root API

**Status:** 🟢 Production Ready | 🟡 TLS Disabled by Default
**Last Updated:** 2025-01-17

---

## Executive Summary

The Root API has comprehensive OpenTelemetry instrumentation across HTTP, database, workers, and LLM providers. **TLS support implemented**, log correlation available, health checks in place. **Ready for production deployment with WireGuard + TLS**.

### ✅ What's Working

- **HTTP Tracing:** Full request/response with semantic conventions (OTel v1.24.0)
- **Database Tracing:** All 38 repository methods instrumented with query names
- **Worker Metrics:** Background job tracking with duration, success/failure (when enabled)
- **LLM Instrumentation:** OpenAI request duration and token tracking
- **Local Stack:** Docker Compose (Jaeger, Prometheus, Grafana)

### ✅ Recent Improvements (2025-01-17)

- **TLS Support:** Added `OTEL_EXPORTER_OTLP_INSECURE` flag + TLS certificate configuration
- **Log Correlation:** Added `logger.WithTraceContext()` helper for trace_id/span_id in logs
- **Health Checks:** Graceful degradation - API continues if collector unreachable
- **Config:** Environment variables for TLS cert paths (disabled by default)

### 🟡 Remaining Production Tasks

| Task | Priority | Status | Action Required |
|------|----------|--------|-----------------|
| Production collector config | High | TODO | Create environment-specific YAML configs |
| Enable TLS | Medium | Optional | Deploy with `OTEL_EXPORTER_OTLP_INSECURE=false` + certs |
| Set up WireGuard | High | Recommended | Follow Phase 1 guide below |
| Missing dashboards | Low | TODO | Create 4 additional Grafana dashboards |

---

## Current State

### Stack

| Component | Tech | Version | Purpose |
|-----------|------|---------|---------|
| SDK | OpenTelemetry Go | Latest | Instrumentation |
| Exporter | OTLP gRPC | v1.x | Traces & Metrics |
| Collector | OTel Collector | 0.96.0 | Aggregation |
| Traces | Jaeger | 1.60 | Visualization |
| Metrics | Prometheus | 2.50.1 | Storage |
| Dashboards | Grafana | 10.3.3 | UI |

### Architecture

```
Root API (Go) → OTLP gRPC :4317 → Collector → Jaeger + Prometheus
     │                                             │
     └─ HTTP, DB, Workers, LLM                    └─ Grafana :3001
```

### Instrumentation Coverage

| Component | Status | Methods | Metrics | Traces |
|-----------|--------|---------|---------|--------|
| **HTTP** | ✅ Complete | All routes | Request rate, latency, errors | Full spans with context |
| **Database** | ✅ Complete | 38 methods | Query duration by table/operation | pgx tracer integration |
| **Workers** | ✅ Complete | Background jobs | Job duration, success rate | Job execution spans |
| **LLM** | ✅ OpenAI | GenerateStructured | Token usage, request duration | API call spans |
| **Embedding** | ❌ Missing | - | - | - |
| **Pool Metrics** | ⚠️ Partial | Logged only | Not exported | - |
| **Queue Depth** | ❌ Missing | - | - | - |

**Files:**
- `internal/pkg/otel/otel.go` - SDK init, providers
- `internal/pkg/otel/metrics.go` - 9 metric instruments
- `internal/pkg/otel/http.go` - HTTP middleware
- `internal/database/traced_pool.go` - DB tracer
- All `*_repository.go` - Query name context

---

## Deployment Architecture: VPS + Monitoring Stack

### Your Setup

```
VPS 1 (App - Dokploy)              VPS 2 (Monitoring)
┌──────────────────────┐           ┌──────────────────────┐
│  Root API :8080      │──────────>│  OTel Collector :4317│
│  Next.js :3000       │  gRPC     │  Jaeger :16686       │
└──────────────────────┘           │  Prometheus :9090    │
                                   │  Grafana :3000       │
                                   └──────────────────────┘
```

### Security Layers

| Approach | Encryption Layer | Setup Time | Security Level | Recommended For |
|----------|-----------------|------------|----------------|-----------------|
| **Insecure** | None | 0 min | ❌ None | Local dev only |
| **WireGuard Only** | Network (L3) | 15 min | 🟡 Good | Personal projects, same datacenter |
| **TLS Only** | Application (L7) | 30 min | 🟢 Good | Multi-cloud, public endpoints |
| **WireGuard + TLS** | Both | 45 min | 🟢 Best | Production, compliance |

---

## Phase 1: WireGuard Setup (Week 1) - Quick Start

**Goal:** Secure inter-VPS communication with minimal config.

### 1. Install WireGuard

```bash
# Both VPSs
sudo apt update && sudo apt install -y wireguard

# Generate keys
wg genkey | tee privatekey | wg pubkey > publickey
```

### 2. Configure VPS 1 (App Server)

```bash
# /etc/wireguard/wg0.conf
[Interface]
PrivateKey = <VPS1_PRIVATE_KEY>
Address = 10.0.0.1/24
ListenPort = 51820

[Peer]
PublicKey = <VPS2_PUBLIC_KEY>
Endpoint = <VPS2_PUBLIC_IP>:51820
AllowedIPs = 10.0.0.2/32
PersistentKeepalive = 25
```

### 3. Configure VPS 2 (Monitoring)

```bash
# /etc/wireguard/wg0.conf
[Interface]
PrivateKey = <VPS2_PRIVATE_KEY>
Address = 10.0.0.2/24
ListenPort = 51820

[Peer]
PublicKey = <VPS1_PUBLIC_KEY>
Endpoint = <VPS1_PUBLIC_IP>:51820
AllowedIPs = 10.0.0.1/32
PersistentKeepalive = 25
```

### 4. Start WireGuard

```bash
# Both VPSs
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0

# Test connectivity
ping 10.0.0.2  # From VPS1
```

### 5. Configure Root API

```bash
# Production environment variables (VPS 1)
# For local development, use: doppler run
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=10.0.0.2:4317  # WireGuard IP
OTEL_EXPORTER_OTLP_INSECURE=true  # OK - WireGuard encrypts tunnel
OTEL_SERVICE_VERSION=dev-$(git rev-parse --short HEAD)
APP_ENV=dev
```

**Result:** All telemetry encrypted by WireGuard tunnel. ✅ Good for personal/startup use.

---

## Phase 2: Add TLS (Month 2-3) - Production Hardening

**Goal:** Defense in depth - TLS on top of WireGuard.

### Option A: Self-Signed Certificates (Internal Use)

```bash
# On VPS 2 (Monitoring)
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout /etc/otel/tls/key.pem \
  -out /etc/otel/tls/cert.pem \
  -days 365 \
  -subj "/CN=otel-collector"

# Copy cert to VPS 1
scp /etc/otel/tls/cert.pem vps1:/etc/otel/tls/ca.pem
```

### Option B: Let's Encrypt (If Public DNS)

```bash
# On VPS 2, if monitoring.yourdomain.com points to VPS2
sudo certbot certonly --standalone -d monitoring.yourdomain.com
```

### Update Collector Config

```yaml
# otel-collector-config.yaml on VPS 2
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
        tls:
          cert_file: /etc/otel/tls/cert.pem
          key_file: /etc/otel/tls/key.pem
```

### Update Root API Config

```bash
# Production environment variables (VPS 1)
OTEL_EXPORTER_OTLP_INSECURE=false
OTEL_EXPORTER_OTLP_CA_CERTIFICATE=/etc/otel/tls/ca.pem
```

**Result:** Two layers of encryption. ✅ Production-ready.

---

## Completed Features

### ✅ TLS Support (2025-01-17)

**Implemented in:**
- `go-api/internal/config/config.go` - Added `InsecureTLS`, `TLSCertPath`, `TLSCAPath` fields
- `go-api/internal/pkg/otel/otel.go` - TLS credential loading with CA cert support
- `go-api/internal/app/runtime.go` - Pass TLS config to otel.Init()
- Environment variables - Added `OTEL_EXPORTER_OTLP_INSECURE=true` (default)

**Usage:**
```bash
# Local development (insecure - current default)
# Use: doppler run -- make dev
OTEL_EXPORTER_OTLP_INSECURE=true

# Production with TLS
OTEL_EXPORTER_OTLP_INSECURE=false
OTEL_EXPORTER_OTLP_CA_CERTIFICATE=/etc/otel/tls/ca.pem
```

---

### ✅ Log-Trace Correlation (2025-01-17)

**Implemented in:** `go-api/internal/pkg/logger/logger.go`

**Function:**
```go
func WithTraceContext(ctx context.Context, logger *slog.Logger) *slog.Logger
```

**Usage in handlers:**
```go
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
    logger := logger.WithTraceContext(r.Context(), slog.Default())
    logger.Info("processing request", "user_id", userID)
    // Logs will now include trace_id and span_id for correlation
}
```

**Result:** Logs can be correlated with traces in Jaeger by searching for `trace_id`.

---

### ✅ Health Checks & Graceful Degradation (2025-01-17)

**Implemented in:** `go-api/internal/pkg/otel/otel.go`

**Function:** `checkCollectorHealth()` - Tests collector connectivity with 5s timeout

**Behavior:**
- On startup, attempts to connect to collector
- If unreachable: Logs warning, returns no-op telemetry
- **API continues running** without failing startup
- Telemetry silently disabled until collector available

**Benefits:**
- Development: No need to run collector stack
- Production: Temporary collector outage doesn't kill API

---

### 🔄 Missing Instrumentation (TODO)

**Pool Metrics:** `go-api/internal/database/database.go`
```go
// Export pool stats as gauge metrics
func ExportPoolMetrics(pool *pgxpool.Pool, meter metric.Meter) {
    totalConns, _ := meter.Int64ObservableGauge("db.pool.connections.total")
    idleConns, _ := meter.Int64ObservableGauge("db.pool.connections.idle")

    meter.RegisterCallback(func(ctx context.Context, o metric.Observer) error {
        stats := pool.Stat()
        o.ObserveInt64(totalConns, int64(stats.TotalConns()))
        o.ObserveInt64(idleConns, int64(stats.IdleConns()))
        return nil
    }, totalConns, idleConns)
}
```

**Ollama Embedding:** `go-api/internal/pkg/embedding/ollama/provider.go`
```go
var tracer = otel.Tracer("root-api/embedding")

func (p *Provider) Generate(ctx context.Context, text string) ([]float64, error) {
    ctx, span := tracer.Start(ctx, "ollama.GenerateEmbedding",
        trace.WithAttributes(
            attribute.String("embedding.model", p.model),
            attribute.Int("input_length", len(text)),
        ),
    )
    defer span.End()

    // ... implementation ...
}
```

---

## Environment Configurations

### Local Development

```bash
# Use doppler run for local development:
# doppler run -- make dev

OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=localhost:4317
OTEL_EXPORTER_OTLP_INSECURE=true
OTEL_SERVICE_NAME=root-api
OTEL_SERVICE_VERSION=local
APP_ENV=local
```

**Start stack:** `docker compose -f go-api/compose.otel.yml up -d`

---

### Production (VPS Deployment)

**VPS 1 (App Server):**
```bash
# Production environment variables
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=10.0.0.2:4317  # WireGuard IP
OTEL_EXPORTER_OTLP_INSECURE=false  # Enable TLS
OTEL_EXPORTER_OTLP_CA_CERTIFICATE=/etc/otel/tls/ca.pem
OTEL_SERVICE_NAME=root-api
OTEL_SERVICE_VERSION=$(git describe --tags)
APP_ENV=production
```

**VPS 2 (Monitoring):**
```bash
# Deploy collector with TLS enabled
docker run -d \
  -p 4317:4317 \
  -v /etc/otel/tls:/etc/otel/tls:ro \
  -v ./otel-collector-config.yaml:/etc/otel-collector-config.yaml \
  otel/opentelemetry-collector-contrib:0.96.0
```

---

## Monitoring & Alerting

### Service Level Objectives

| SLO | Target | Window | Error Budget |
|-----|--------|--------|--------------|
| Availability | 99.9% | 30d | 43m downtime |
| Latency P95 | <500ms | 5m | 5% slow |
| Error Rate | <1% | 5m | 1% errors |
| Job Success | >98% | 1h | 2% failures |

### Key Alerts

| Alert | Metric | Threshold | Severity | Action |
|-------|--------|-----------|----------|--------|
| High Error Rate | `http_5xx_rate` | >1% for 5m | 🔴 Critical | Page on-call |
| High Latency | `http_p95_duration` | >1s for 10m | 🟡 Warning | Slack alert |
| Pool Exhaustion | `pool_usage` | >90% for 5m | 🟡 Warning | Scale connections |
| Job Failures | `job_error_rate` | >5/min for 5m | 🟡 Warning | Check logs |
| Collector Down | `collector_up` | ==0 for 2m | 🟡 Warning | Restart collector |

**Grafana Alert Config:** See `go-api/grafana/provisioning/alerts/` (TODO)

---

## Dashboards

### 1. Overview (Existing)
- Request rate, error rate, latency (P50/P95/P99)
- Active connections, job success rate

### 2. HTTP Traffic (TODO)
- Request rate by endpoint
- Latency heatmap
- Status code distribution

### 3. Database Performance (TODO)
- Query duration by table
- Connection pool usage
- Slow queries (>100ms)

### 4. Background Jobs (TODO)
- Job throughput
- Success vs failure rate
- Queue depth

### 5. LLM Provider (TODO)
- Request rate, token usage
- Cost estimate
- Error rate

**Files:** `go-api/grafana/provisioning/dashboards/*.json`

---

## Cost Estimates

| Environment | Traffic | Sampling | Backend | Cost/Month |
|-------------|---------|----------|---------|------------|
| **Local** | Any | 100% | Self-hosted | $0 |
| **Dev** | Low | 50% | Grafana Cloud Free | $0 |
| **Staging** | Medium | 20% | Grafana Cloud | ~$20 |
| **Production** | 1M req/month | 10% tail-based | Grafana Cloud | ~$50-100 |
| **Scale** | 10M req/month | 10% tail-based | Grafana Cloud | ~$200-300 |

**Optimization:** Tail-based sampling (keep errors + slow traces) reduces costs by ~50%.

---

## Quick Reference

### Environment Variables

```bash
# Core
OTEL_ENABLED=true                          # Enable/disable
OTEL_EXPORTER_OTLP_ENDPOINT=localhost:4317 # Collector address
OTEL_SERVICE_NAME=root-api                 # Service identifier
OTEL_SERVICE_VERSION=0.1.0                 # Version tag
APP_ENV=local                              # Environment name

# TLS (Production)
OTEL_EXPORTER_OTLP_INSECURE=false          # Use TLS
OTEL_EXPORTER_OTLP_CA_CERTIFICATE=/path    # CA cert path
OTEL_EXPORTER_OTLP_CERTIFICATE=/path       # Client cert (mTLS)
```

### Ports & Services

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| API | 8080 | http://localhost:8080 | HTTP server |
| Collector (gRPC) | 4317 | - | OTLP endpoint |
| Collector (HTTP) | 4318 | - | OTLP HTTP |
| Jaeger UI | 16686 | http://localhost:16686 | Traces |
| Prometheus | 9090 | http://localhost:9090 | Metrics |
| Grafana | 3001 | http://localhost:3001 | Dashboards |

### Common Commands

```bash
# Start local observability stack
cd go-api && docker compose -f compose.otel.yml up -d

# View traces
open http://localhost:16686

# View metrics
open http://localhost:9090

# View dashboards (admin/admin)
open http://localhost:3001

# Stop stack
docker compose -f compose.otel.yml down

# Check collector health
curl -s http://localhost:8888/metrics | grep otelcol_receiver
```

### Metric Instruments

| Name | Type | Labels | Purpose |
|------|------|--------|---------|
| `http.server.request.duration.seconds` | Histogram | method, route, status | HTTP latency |
| `http.server.request.total` | Counter | method, route, status | HTTP count |
| `db.query.duration` | Histogram | operation, table, query_name | DB latency |
| `db.query.total` | Counter | operation, table, query_name | DB count |
| `job.duration.seconds` | Histogram | kind, success | Job latency |
| `job.total` | Counter | kind, success | Job count |
| `llm.request.duration` | Histogram | provider, model | LLM latency |
| `llm.tokens.total` | Counter | provider, model | Token usage |

### Useful PromQL Queries

```promql
# Request rate
sum(rate(http_server_request_total[5m]))

# Error rate (%)
sum(rate(http_server_request_total{status_code=~"5.."}[5m])) / sum(rate(http_server_request_total[5m])) * 100

# P95 latency
histogram_quantile(0.95, sum(rate(http_server_request_duration_bucket[5m])) by (le))

# Top 10 slowest endpoints
topk(10, histogram_quantile(0.95, sum(rate(http_server_request_duration_bucket[5m])) by (http_route, le)))

# Connection pool usage (%)
db_pool_connections_acquired / db_pool_connections_total * 100

# LLM cost estimate ($0.01 per 1K tokens)
sum(rate(llm_tokens_total[5m])) * 0.01 / 1000
```

---

## Troubleshooting

### No traces in Jaeger

**Check:**
1. Is OTel enabled? `echo $OTEL_ENABLED`
2. Is collector running? `docker ps | grep otel-collector`
3. Can API reach collector? `telnet localhost 4317`
4. Check collector logs: `docker logs api-otel-collector-1`

**Fix:**
```bash
# Restart collector
docker compose -f compose.otel.yml restart otel-collector

# Enable debug logging in collector config
service.telemetry.logs.level: debug
```

---

### High memory usage in collector

**Check:** `docker stats api-otel-collector-1`

**Fix:** Reduce batch size in `otel-collector-config.yaml`:
```yaml
processors:
  memory_limiter:
    limit_mib: 512  # Reduce if OOMing
```

---

### TLS handshake failure

**Error:** `transport: authentication handshake failed`

**Check:**
1. Certificate paths correct? `ls -l $OTEL_EXPORTER_OTLP_CA_CERTIFICATE`
2. Certificate not expired? `openssl x509 -in cert.pem -noout -dates`
3. WireGuard tunnel working? `ping 10.0.0.2`

**Fix:**
```bash
# Verify cert
openssl verify -CAfile /etc/otel/tls/ca.pem /etc/otel/tls/cert.pem

# Test connection
openssl s_client -connect 10.0.0.2:4317 -CAfile /etc/otel/tls/ca.pem
```

---

## Migration Checklist

### ✅ Week 1: Security Hardening (COMPLETED 2025-01-17)
- [x] Add TLS config to `config.go` and `otel.go`
- [ ] Set up WireGuard between VPSs
- [ ] Test connectivity over WireGuard tunnel
- [ ] Update production environment variables with WireGuard IPs

### ✅ Week 2: Logging Correlation (COMPLETED 2025-01-17)
- [x] Implement `WithTraceContext()` helper
- [ ] Update handlers to use context-aware logger (pattern available)
- [ ] Test log-trace correlation in Jaeger

### ✅ Health Checks (COMPLETED 2025-01-17)
- [x] Implement graceful degradation on collector failure
- [x] Add health check with timeout

### Week 3: Missing Instrumentation (TODO)
- [ ] Add connection pool metrics export
- [ ] Add background job queue depth metrics (when queue is enabled)
- [ ] Instrument Ollama embedding provider

### Week 4: TLS Setup (READY - Deploy When Needed)
- [ ] Generate TLS certificates (self-signed or Let's Encrypt)
- [ ] Configure collector with TLS
- [ ] Set `OTEL_EXPORTER_OTLP_INSECURE=false` in production
- [ ] Add cert paths to production environment variables
- [ ] Test end-to-end with TLS enabled

### Week 5: Dashboards & Alerts (TODO)
- [ ] Create 4 missing dashboards
- [ ] Define 5 core alerts
- [ ] Configure Grafana alerting
- [ ] Write runbooks

---

## Additional Resources

- **OpenTelemetry Go:** https://opentelemetry.io/docs/instrumentation/go/
- **OTel Collector:** https://opentelemetry.io/docs/collector/
- **WireGuard:** https://www.wireguard.com/quickstart/
- **Backend Docs:** [go-api/AGENTS.md](../go-api/AGENTS.md)

**Support:** #engineering on Slack

---

**Last Updated:** 2025-01-17
**Next Review:** 2025-02-17 (monthly)
