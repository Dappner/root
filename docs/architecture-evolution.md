# Architecture Evolution

## Long-term Target (Production Scale)

**Stack**:
- Vite - lightweight SPA frontend
- Hono - dedicated auth service (Better-Auth)
- Go - single backend for all data operations
- Colocated infrastructure (Go API + DB in same region)

**Why Simplify**:
- **Single backend**: All writes through Go → clearer boundaries
- **No latency workaround**: Colocated infra eliminates need for Next.js direct DB access
- **Less framework magic**: Vite = simpler dev experience, faster builds
- **Dedicated auth**: Hono service separates concerns cleanly

**What Changes**:
- ❌ Next.js API routes → ✅ All reads/writes via Go
- ❌ Better-Auth in Next.js → ✅ Better-Auth in Hono service
- ❌ SSR → ✅ SPA (unless SEO needed, then Vite SSR)

**Migration Path**:
1. Colocate Go backend + DB (removes latency incentive)
2. Build Hono auth service (migrate Better-Auth transport layer)
3. Replace Next.js with Vite (big-bang frontend swap)

---

## Notes

- **Cache not needed**: Redis was considered for current latency, but won't be needed when infra is colocated
- **Timeline**: Keep hybrid until Go backend proves stable and colocated deployment is ready
- **Current is correct**: For solo dev shipping fast, Next.js hybrid maximizes velocity
