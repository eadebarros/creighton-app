# Creighton Family Tracker & Guide

Instrumento clínico de apoio a decisão reprodutiva, baseado no método Creighton.

- Documentação de arquitetura/produto: [`briefing/CREIGHTON_TRACKER_ESTADO_ATUAL_V2.md`](briefing/CREIGHTON_TRACKER_ESTADO_ATUAL_V2.md) (V2 — pendências da Seção 8 resolvidas; V1 mantido no histórico)
- Estado de progresso da Sprint 1 (o que falta, decisões tomadas, como continuar em outra máquina): [`briefing/SPRINT1_PROGRESS.md`](briefing/SPRINT1_PROGRESS.md)
- Design system e protótipos: [`design/README.md`](design/README.md)

## Estrutura

- `packages/rules-engine` — Motor de Regras Creighton (`@creighton/rules-engine`), pacote TypeScript puro, sem UI/DB. Sprint 0, fechado.
- `packages/app` — App Expo + React Native (`@creighton/app`): captura diária, SQLite local, gráfico do ciclo. Sprint 1, aguardando teste manual em dispositivo (ver `SPRINT1_PROGRESS.md`).

Ver a Seção 5 do briefing para o sequenciamento completo de sprints.
