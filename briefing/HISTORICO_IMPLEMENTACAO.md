# Histórico de Implementação — Creighton Family Tracker & Guide

**Última atualização:** 2026-07-12
**Status:** Primeiro build de produção enviado ao TestFlight (App Store Connect app `6790194835`).

Este documento existe pra não perder o histórico do que foi construído, decidido e corrigido — sessão a sessão, do Sprint 0 até hoje. O código e os commits do Git são a fonte de verdade; este arquivo é o resumo narrado, pra retomar contexto rápido em qualquer máquina ou depois de um tempo parado. Cada seção referencia os commits reais (`git log --oneline`).

---

## Sprint 0 — Motor de Regras (`@creighton/rules-engine`)
`856f543`, `87d9021`, `c961913` — 2026-07-10

Pacote TypeScript puro, sem UI/DB, implementando o motor de regras do Método Creighton pro ciclo REGULAR: código bruto (VDRS), token de cor por precedência (sangramento > PIB > muco fértil > infértil), rastreamento de Ápice (Tc, confirmação por 3 dias não-pico), recálculo retroativo.

Correção real encontrada: a cascata do "dia alternado" (Wait and See / Semen Clearing) estava quebrada — corrigida após validação clínica da instrutora (`c961913`).

## Sprint 1 — App Expo/RN, captura + persistência local
`c3f9c81`, `c6ad69c` — 2026-07-10

`packages/app`: SQLite local, fluxo de captura de 5 telas (Sangramento → Sensação → Cor/Elasticidade do muco → Relação sexual → Confirmação), `<StampBadge>`, gráfico do ciclo agrupado por fase.

Testado em iPhone físico via Expo Go — 3 bugs reais encontrados e corrigidos (fragmentação de ciclo, reatividade de navegação, safe-area). Ver `briefing/SPRINT1_PROGRESS.md` pros detalhes completos dessa sprint específica.

## Sprint 2 — Backend + autenticação + sync
`a94e72d`, `8175736`, `894fcd7` — 2026-07-10/11

`packages/backend`: Express + Prisma + Postgres (Railway) + Clerk (`@clerk/express`). App conectado ao Clerk (auth) e sync outbox local→servidor.

Bug de deploy: `prisma` precisa ser dependency real (não devDependency) pro Railway rodar `prisma generate` no build.

## Sprint 3 — Vínculo de parceiro (dual-sync casal)
`d345837`, `cbcd9df` — 2026-07-11

Convite por código (8 caracteres, expira em 24h), vínculo simétrico `partnerId`, papel `COOP_PARTNER` pro parceiro. Dashboard do Homem (status resumido, sem dado bruto).

Bug real: SQLite local não tinha escopo por usuário — corrigido pra limpar dados locais quando uma identidade Clerk *diferente* faz login no mesmo aparelho (`ensureLocalDataMatchesSignedInUser`, em `RoleGate.tsx`).

## Sprint 4a — Variante Lactação
`92527ad` — 2026-07-11

Fase de observação (dias 1-15 força FÉRTIL), Padrão Infértil Básico (PIB) por 3 códigos brutos iguais consecutivos (só prospectivo, nunca retroativo).

## Adendo 01 — Múltiplas observações diárias
`688f092`, `b4ad5a1` — 2026-07-11

Mudança de modelo: `Observation` vira evento bruto append-only (uma linha por checagem intradiária); `DailyEntry` vira derivado/consolidado ("pico do dia"), recalculado por `pickDailyPeak`. Anulação (`voided`) em vez de edição/exclusão.

Botão "Registrar hoje" no gráfico passa a virar "Novo registro" quando já há registro no dia (`b4ad5a1`).

## SPEC 02 — Exportação PDF clínica
`486d3b4`, `4821526` — 2026-07-11/12

`POST /exports/pdf`: só PRIMARY_OBSERVER exporta, PDF nunca fica no servidor (gerado em memória via `pdfkit`, não Puppeteer), rate-limited (10/hora).

**Decisão revertida em produção:** a exigência de senha no PDF foi removida (`4821526`) — decisão do Edu, não bug. Verificado antes que a criptografia funcionava corretamente (via `pdfjs-dist` temporário) antes de remover, pra confirmar que era mudança de escopo, não correção de falha.

## Adendo 02 — Confirmação de Ápice cross-ciclo (Pré-menopausa)
`8c15b84` — 2026-07-12

Peça que faltava pra habilitar a variante Pré-menopausa: a confirmação do Ápice de um ciclo depende da menstruação real do ciclo *seguinte* cair numa janela de 8-16 dias após Tc+4. Resolvido com uma função pura nova (`confirmPeakOnCycleClose`) chamada só no evento de fechamento de ciclo — o motor continua estritamente por-ciclo, sem contaminar Regular/Lactação (critério de regressão: suíte completa sem alteração).

Durante ciclo aberto, o casal fica em FÉRTIL (nunca INFERTILE_ABSOLUTE) até o fechamento real confirmar — evita alarme falso de "infértil" que depois se prove errado.

## Ferramenta de teste: reset de conta
`e78d65f` — 2026-07-12

A pedido do Edu, pra testar sem esperar dias reais passarem: reset de dados (local + servidor) de uma conta específica. Depois migrado pra dev-only (ver SPEC 03 Etapa 4).

Truque de teste sem código: `today()` (`domain/dateMath.ts`) lê a data do aparelho — mudar a data do iPhone em Ajustes simula dias diferentes sem precisar de nenhuma ferramenta.

## SPEC 03 — Perfil & Configurações
`75fdbea` → `78cbdbd` (6 commits, uma etapa por commit) — 2026-07-12

Área de configurações nova, tirando 4 ações soltas do header do gráfico (convidar parceiro, exportar, resetar, sair):

1. **Hub + navegação** — tela de Configurações central, header do gráfico reduzido a "Novo registro" + ícone de perfil.
2. **Alterar senha / Termos / rodapé** — senha via API real do Clerk (não há senha no nosso banco); Termos reaproveita texto do onboarding + timestamp real de aceite (`instructorCredentialAckAt`, campo novo).
3. **Notificações locais** — lembrete diário 100% local (`expo-notifications`, sem push/backend), suprimido quando já há registro no dia, conteúdo nunca revela dado clínico.
4. **Reset de conta de teste → dev-only** — só existe em `__DEV__`, com checagem de outbox pendente antes de resetar.
5. **Desvincular parceiro** — `POST /partner/unlink`, simétrico, quem era COOP_PARTNER volta a PRIMARY_OBSERVER.
6. **LGPD** — baixar dados (JSON completo, sem senha) e excluir conta (hard delete + exclusão da identidade no Clerk, reautenticação real via `session.attemptFirstFactorVerification`).

## Login com Google e Apple
`09c921c` — 2026-07-12

Via `useSSO` do Clerk (fluxo por navegador, `expo-auth-session` + `expo-web-browser`) — deliberadamente **não** usa `expo-apple-authentication` (native, exigiria dev client), pra continuar 100% compatível com Expo Go.

## Migração pra Clerk de produção — a saga de hoje
`06e6abe` → `8778bcc` (7 commits) — 2026-07-12

Sequência de causas reais encontradas ao trocar as chaves de dev pra produção, cada uma mascarando a próxima:

1. **Domínio customizado do Clerk sem DNS configurado** (`clerk.creighton.edudebarros.com.br`) — app travava indefinidamente tentando inicializar o Clerk, sem erro visível (tela branca/preta). Resolvido criando os registros CNAME no Cloudflare (DNS do domínio, apesar do registro ser no Registro.br).
2. **Bug meu introduzido durante o diagnóstico** — `ClerkFailed`/`ClerkDegraded` importados de `@clerk/react` direto (não `@clerk/expo`) quebravam por incompatibilidade de contexto React. Corrigido, removido.
3. **URL de redirect do Google/Apple não autorizada** — Clerk exige allowlist de redirect URLs; resolvido registrando via API do Clerk (`POST /v1/redirect_urls`, com autorização explícita do Edu antes de mexer em config de auth de produção).
4. **Contas duplicadas por e-mail** — Clerk trata senha e Google como identidades diferentes (`clerkUserId` distintos); login por um método depois do outro batia no `email @unique` do nosso banco e dava 500. Corrigido em `requireUser.ts`: religa a conta existente pelo e-mail em vez de tentar criar duplicata — login funciona por qualquer um dos dois métodos, sempre a mesma conta (merge silencioso, decisão do Edu — sem tela de confirmação por enquanto).

Padrão útil descoberto: `console.log` não aparece no Metro quando rodando não-interativo (só `console.warn`/`console.error` aparecem) — usar `console.warn` pra debug ao vivo.

## EAS Build + TestFlight
`7fd447c`, `457ffad` — 2026-07-12

Primeira vez saindo do Expo Go pra um binário de verdade. `br.com.edudebarros.creighton`, projeto EAS `@eadebarros/creighton-tracker`, App Store Connect app `6790194835`.

Dois bugs só visíveis em build remoto (nunca em Expo Go nem no deploy do Railway):
1. **`@creighton/rules-engine` sem build** — EAS Build nunca roda o script `build` da raiz do monorepo (o Railway roda); o `dist/` do rules-engine (gitignored) nunca existia no clone remoto. Corrigido com o hook `eas-build-post-install` no `package.json` do app.
2. **Variáveis `EXPO_PUBLIC_*` do `.env` local invisíveis pro build remoto** — precisou registrar as mesmas no EAS (`eas env:create`) pros 3 ambientes (production/preview/development).

Primeiro build (produção, build number 3) processado e enviado ao TestFlight com sucesso.

---

## Onde estamos agora (2026-07-12, fim do dia)

- App em teste real com Edu e a esposa, via TestFlight (aguardando processamento da Apple / criação de testadores internos).
- Backend em produção no Railway, Postgres real, Clerk em produção com domínio customizado funcionando.
- SPEC 03 completa (todas as 6 etapas). Google/Apple sign-in funcionando.
- Pendências conhecidas, não bloqueantes:
  - Seletor de ciclos/calendário histórico — adiado a pedido do Edu, sem data.
  - Tela de confirmação explícita no merge de conta por e-mail — decisão do Edu de manter simples por enquanto, pode ser revisitada.
  - "Sign in with Apple" configurado no Clerk (Google já está; Apple foi construído no código mas a configuração de credenciais no painel ainda não foi feita) — necessário antes de submissão pra revisão completa da App Store (regra 4.8), não bloqueia TestFlight.
  - Política de Privacidade hospedada (URL pública) — necessária pro cadastro completo do app na App Store Connect, ainda não feita.
