# SecureShip AI

Security-gated delivery: secrets, vulnerabilities, and deployments in one dashboard. **Phase 1 of 8: application, database, and dashboard.**

> **Not production-ready: no authentication yet.** Do not expose this dashboard to the internet until a later phase adds auth and signed CI ingestion.

## Quick start

Prerequisites: Node 22+, PostgreSQL 16 (or Docker).

```bash
cp .env.example .env.local          # then set DATABASE_URL
docker compose up -d db             # optional: local Postgres (set POSTGRES_PASSWORD to match .env.local)
npm install                         # also runs `prisma generate`
npm run db:deploy                   # apply migrations
npm run db:seed                     # OPTIONAL demo data, every row is labelled "Demo" in the UI
npm run dev                         # http://localhost:3000
```

Scripts: `npm test` · `npm run lint` · `npm run typecheck` · `npm run build` · `npm run db:migrate` (create a migration) · `npm run db:deploy` (apply).

## Design rules enforced in code

- **No column can store a secret value.** Secret findings keep a one-way fingerprint, rule ID, and file/line only. A test fails if a value-bearing column is ever added.
- Logs and audit metadata are key-redacted (`token`, `password`, `authorization`, ...).
- The release gate shown on the dashboard is the stored **deterministic policy decision**. AI never sets it.
- Demo data is flagged `isDemo` and always shows a **Demo** tag and banner.

## Status (what is verified)

| Area | State |
|---|---|
| Next.js app, 7 dashboard pages, light/dark, responsive | Built and verified (build, lint, screenshots) |
| PostgreSQL schema, migration, seed | Migration applied and queried against PostgreSQL 16 |
| Repository API (Zod-validated), health endpoint | Verified with valid and hostile input |
| Unit + integration tests | 18 passing |
| Gitleaks / Trivy / Semgrep, pre-push hook, CI, policy engine | **Not built yet** |
| Email (SES), AI (Ollama), Docker image, GHCR, AWS OIDC/EC2 | **Not built yet** |

## First thing to run on your machine

The initial migration was written by hand and applied with `psql`, because the authoring sandbox could not download Prisma's migration engine. Run `npx prisma migrate dev` once. If Prisma reports drift or generates an extra migration, commit it.
