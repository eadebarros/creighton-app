# Creighton Family Tracker & Guide

Instrumento clínico de apoio a decisão reprodutiva, baseado no método Creighton.

- Documentação de arquitetura/produto: [`briefing/CREIGHTON_TRACKER_ESTADO_ATUAL_V2.md`](briefing/CREIGHTON_TRACKER_ESTADO_ATUAL_V2.md) (V2 — pendências da Seção 8 resolvidas; V1 mantido no histórico)
- **Histórico completo de implementação** (Sprint 0 até hoje, sessão a sessão, com commits): [`briefing/HISTORICO_IMPLEMENTACAO.md`](briefing/HISTORICO_IMPLEMENTACAO.md)
- Estado de progresso da Sprint 1 especificamente: [`briefing/SPRINT1_PROGRESS.md`](briefing/SPRINT1_PROGRESS.md)
- Design system e protótipos: [`design/README.md`](design/README.md)

## Estrutura

- `packages/rules-engine` — Motor de Regras Creighton (`@creighton/rules-engine`), pacote TypeScript puro, sem UI/DB.
- `packages/app` — App Expo + React Native (`@creighton/app`): captura diária, SQLite local, gráfico do ciclo, Configurações (SPEC 03), login Google/Apple. Primeiro build de produção no TestFlight (ver histórico de implementação).
- `packages/backend` — API Express + Prisma + Postgres (Railway), Clerk em produção.

Ver `briefing/HISTORICO_IMPLEMENTACAO.md` pro estado atual completo e o que falta.
