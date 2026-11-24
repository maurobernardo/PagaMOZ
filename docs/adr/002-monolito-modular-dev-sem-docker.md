# ADR-002 — Monólito modular, desenvolvimento sem Docker

**Estado:** aceite · **Data:** 2026-11-24

## Decisão
- Um projecto Django com apps por domínio; um app Next.js com áreas cidadão/instituição/admin.
- Dev local sem Docker: SQLite e Celery em modo *eager* quando `DATABASE_URL`/`REDIS_URL` não
  estão definidos. CI e produção usam Postgres + Redis (`infra/docker-compose.yml`).
- `npm` workspaces (sem pnpm) e `tasks.ps1` como equivalente do `Makefile` no Windows.

## Consequências
- Arranque em qualquer máquina Windows com só Python e Node.
- Risco: diferenças SQLite/Postgres (locks, `select_for_update`). Mitigação: o CI corre sempre em
  Postgres; testes de concorrência do ledger (Fase 2) marcados para correr só em Postgres.
