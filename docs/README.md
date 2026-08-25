# Root Documentation

Welcome to the Root documentation! This directory contains comprehensive documentation about the product, features, architecture, and development.

---

## 📚 Documentation Index

### Getting Started

- **[Main README](../README.md)** — Project overview, setup instructions, and quick start
- **[Product Overview](product_overview.md)** — What Root is and core concepts
- **[Product Philosophy](product_philosophy.md)** — Design principles and values

### Features & Roadmap

- **[Features Documentation](FEATURES.md)** — Complete list of all implemented features
- **[Product Roadmap](ROADMAP.md)** — Planned features organized by priority and timeline
- **[Changelog](CHANGELOG.md)** — Version history and notable changes

### Architecture & Development

- **[Main Architecture](../AGENTS.md)** — High-level system architecture and service interactions
- **[Backend Guide](../go-api/AGENTS.md)** — Go backend development guide
- **[Frontend Guide](../frontend/AGENTS.md)** — Next.js frontend development guide
- **[RAG Service](../fast-api/AGENTS.md)** — Python Fast API service documentation (external service integration, AI operations)
- **[Architecture Evolution](architecture-evolution.md)** — Long-term architecture plan

### Feature-Specific Guides

- **[Review System](review-system.md)** — Spaced repetition system implementation details
- **[Podcast Transcripts](PODCAST_TRANSCRIPTS.md)** — Transcript generation setup and usage
- **[Public Profile & Visibility](public-profile-visibility.md)** — Sharing model, visibility enum, and privacy rules
- **[Authentication](auth.md)** — Auth architecture and JWT flow
- **[Observability](observability.md)** — Monitoring, tracing, and logging setup
- **[Deployment](DEPLOY.md)** — Deployment guide and infrastructure

### Design Documents

Design documents are stored in the `plans/` directory and contain detailed feature designs:

- **[Source Recall Tab](plans/2026-01-03-source-recall-tab-design.md)** — Recall tab design (2026-01-03)
- **[Ad-Hoc Review System](plans/2026-01-04-ad-hoc-review-system-design.md)** — Simplified review mode (2026-01-04)
- **[Admin User Stats](plans/2026-01-05-admin-user-stats-design.md)** — User statistics dashboard (2026-01-05)
- **[Admin User Stats Implementation](plans/2026-01-05-admin-user-stats-implementation.md)** — Implementation details (2026-01-05)

---

## 📖 Documentation by Topic

### Product & UX

| Document | Description |
|----------|-------------|
| [Product Overview](product_overview.md) | Core concepts, system principles, what Root enables |
| [Product Philosophy](product_philosophy.md) | Design principles and product values |
| [Features](FEATURES.md) | Complete feature catalog with implementation details |
| [Roadmap](ROADMAP.md) | Future plans, priorities, and timeline |

### Architecture & Technical

| Document | Description |
|----------|-------------|
| [Main Architecture](../AGENTS.md) | Service interactions, auth flow, data patterns |
| [Backend Guide](../go-api/AGENTS.md) | Go backend patterns, testing, deployment |
| [Frontend Guide](../frontend/AGENTS.md) | Next.js patterns, data fetching, type safety |
| [RAG Service](../fast-api/AGENTS.md) | External service integration (R2, AssemblyAI, YouTube, LLMs), AI operations |
| [Architecture Evolution](architecture-evolution.md) | Migration path from hybrid to target state |

### Features & Implementation

| Document | Description |
|----------|-------------|
| [Review System](review-system.md) | SM-2 algorithm, AI generation, ad-hoc mode |
| [Podcast Transcripts](PODCAST_TRANSCRIPTS.md) | AssemblyAI integration, R2 storage, UI |
| [Public Profile & Visibility](public-profile-visibility.md) | Sharing scope model (`none`, `feed`, `public`) and rollout plan |
| [Authentication](auth.md) | Better-Auth, JWT validation, JWKS flow |
| [Observability](observability.md) | OpenTelemetry, Jaeger, Grafana setup |

### Operations

| Document | Description |
|----------|-------------|
| [Deployment](DEPLOY.md) | Infrastructure, CI/CD, environment setup |
| [Changelog](CHANGELOG.md) | Version history, breaking changes, migrations |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (Next.js 16)                   │
│     Better-Auth + Server Components + App Router        │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐                      │
│  │ UI (React)  │  │  Better-Auth │                      │
│  │ Components  │  │  (auth.*)    │                      │
│  └─────────────┘  └──────────────┘                      │
└────────┬──────────────────┬──────────────────────────────┘
         │                  │
         │ CRUD (proxy)    │ JWKS
         │ AI ops (direct) │               │
         │                  │               │
┌────────┴──────────────────┐    ┌─────────┴───────────────┐
│   Backend (Go/Chi)         │    │  Python RAG Service      │
│   CRUD + Background Jobs   │    │  AI Operations (FastAPI) │
│   Port 8080                │    │  Port 8081               │
└────────────────────┬───────┘    └────────────────────┬────┘
                     │                                 │
                     └─────────────────┬───────────────┘
                                       │
                     ┌─────────────────┴───────────────┐
                     │   PostgreSQL + pgvector          │
                     │   • Better-Auth Tables (auth.*)  │
                     │   • App Tables (public.*)        │
                     │   • RAG Embeddings               │
                     └──────────────────────────────────┘
```

---

## 🧭 Quick Links by Role

### For Product Managers
- Start with [Product Overview](product_overview.md)
- Review [Features](FEATURES.md) to see what's implemented
- Check [Roadmap](ROADMAP.md) for priorities and timeline
- Read [Product Philosophy](product_philosophy.md) for design principles

### For Developers
- Read [Main Architecture](../AGENTS.md) for system overview
- Go to [Backend Guide](../go-api/AGENTS.md) or [Frontend Guide](../frontend/AGENTS.md) based on your work
- Review [Changelog](CHANGELOG.md) for recent changes
- Check relevant feature guides (Review System, Transcripts, etc.)

### For DevOps/Infrastructure
- Start with [Architecture Overview](../AGENTS.md)
- Read [Deployment Guide](DEPLOY.md)
- Set up [Observability](observability.md)
- Review [Architecture Evolution](architecture-evolution.md) for future plans

### For Designers
- Read [Product Overview](product_overview.md) and [Philosophy](product_philosophy.md)
- Review [Features](FEATURES.md) to understand current capabilities
- Check design documents in `plans/` for detailed UX specs
- See [Roadmap](ROADMAP.md) for upcoming features

---

## 📝 Documentation Standards

### File Organization

- **Root-level docs** (`/docs/`) — Product, features, architecture
- **Service-specific docs** (`/go-api/AGENTS.md`, `/frontend/AGENTS.md`) — Implementation details
- **Inline docs** — README files in subdirectories for specific modules

### Naming Conventions

- **All caps** for major documents: `FEATURES.md`, `ROADMAP.md`, `CHANGELOG.md`
- **Lowercase with hyphens** for feature docs: `review-system.md`, `podcast-transcripts.md`
- **Date prefix for plans** — `YYYY-MM-DD-feature-name-design.md`

### Document Structure

Each major document should include:
1. Title and description
2. Table of contents (for long docs)
3. Clear sections with headers
4. Code examples where relevant
5. Links to related docs
6. Last updated date

---

## 🤝 Contributing to Documentation

### Adding New Documentation

1. Choose the appropriate location:
   - Product/features → `/docs/`
   - Service-specific → `/go-api/`, `/frontend/`, `/fast-api/`
   - Design specs → `docs/`

2. Follow naming conventions (see above)

3. Add entry to this index (README.md)

4. Link from relevant documents

5. Update related docs if needed

### Updating Existing Documentation

1. Keep the "Last Updated" date current
2. Update links if file names change
3. Maintain backward compatibility (add redirects if needed)
4. Update the [Changelog](CHANGELOG.md) for significant doc changes

### Writing Guidelines

- **Be concise** — Respect the reader's time
- **Use examples** — Show, don't just tell
- **Link liberally** — Help readers find related info
- **Keep it current** — Update docs when code changes
- **Think about audience** — Write for the intended reader

---

## 🔍 Finding Information

### Search Strategies

1. **Start with this index** — Scan the topic-based organization
2. **Use your IDE's search** — Search across all markdown files
3. **Check related docs** — Most docs link to related content
4. **Look at design docs** — Feature designs have detailed specs
5. **Read the changelog** — Find when features were added

### Common Questions

**Q: Where do I start as a new developer?**
A: [Main Architecture](../AGENTS.md) → [Backend](../go-api/AGENTS.md) or [Frontend](../frontend/AGENTS.md) guide → Relevant feature docs

**Q: How do I find out when a feature was added?**
A: Check [Changelog](CHANGELOG.md) or [Features](FEATURES.md) (includes migration references)

**Q: Where are API endpoint docs?**
A: In the [Backend Guide](../go-api/AGENTS.md) and individual feature docs (e.g., [Review System](review-system.md))

**Q: How do I understand the data model?**
A: See [Features](FEATURES.md) for schema references, or check `/go-api/migrations/*.sql` directly

**Q: What's planned for the future?**
A: See [Roadmap](ROADMAP.md) organized by priority and timeline

---

## 📚 External Resources

### Technologies Used

- [Next.js 16 Docs](https://nextjs.org/docs)
- [Go Documentation](https://go.dev/doc/)
- [Better-Auth](https://www.better-auth.com/docs)
- [React Query](https://tanstack.com/query/latest)
- [shadcn/ui](https://ui.shadcn.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [pgvector](https://github.com/pgvector/pgvector)
- [AssemblyAI Docs](https://www.assemblyai.com/docs)
- [OpenTelemetry](https://opentelemetry.io/docs/)

### Learning Resources

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [SM-2 Algorithm](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)

---

## 📞 Getting Help

### Internal Resources

1. Check this documentation index
2. Search for keywords across docs
3. Review design documents in `plans/`
4. Look at inline code comments
5. Check git history for context

### External Help

- Open an issue on GitHub for bugs or questions
- Check existing issues for solutions
- Review pull requests for implementation examples

---

**Last Updated:** January 2026
