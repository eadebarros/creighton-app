# Sprint 1 — Estado de Progresso

**Última atualização:** 2026-07-10
**Status:** código completo e validado por testes/typecheck/bundle. Falta apenas o teste manual em dispositivo real (nenhum emulador disponível no ambiente onde isso foi construído — um PC Windows sem SDK Android nem Mac).

Este documento existe para não perder o histórico entre máquinas: foi escrito na sessão que implementou a Sprint 1 num PC Windows, e o trabalho continua num MacBook. O código e os commits do Git são a fonte da verdade; este arquivo é só o resumo de onde as coisas pararam.

## O que já está fechado

### Sprint 0 — Motor de Regras (`@creighton/rules-engine`)
Fechado e commitado (`87d9021`, `c961913`). 59 testes passando. Inclui a correção da regra do dia alternado (Wait and See / Semen Clearing) validada pela instrutora em 2026-07-10 — ver `briefing/CREIGHTON_TRACKER_ESTADO_ATUAL_V2.md` Seção 3.4 para a regra corrigida.

Pendência aberta (não bloqueia Sprint 1): validação clínica externa de um ciclo completo simulado contra um gráfico Creighton real (Seção 7 do briefing) — Edu está aguardando resposta da instrutora.

### Sprint 1 — Captura local + persistência (`packages/app`)
Pacote Expo + React Native + TypeScript, novo workspace do monorepo. Tudo implementado e testado:

- **SQLite local** (`src/db/`): schema (`cycles` + `daily_entries`), interface `SqlExecutor` (compatível com `expo-sqlite` em produção e `better-sqlite3` em teste), repositórios de ciclo e de entrada diária. Sem tabela de estado versionado ainda — `computed_state`/`peak_relation` são recalculados em memória a cada leitura via `computeFertilityStates` (decisão documentada no plano original, ver commit history).
- **Camada de domínio** (`src/domain/`): `stateToToken` (regra de cor única), `resolveCycleForNewEntry` (limites de ciclo — só H/M fecha/abre ciclo), `mapping.ts` (conversões DB row ↔ `DailyEntryInput` ↔ respostas da captura), `dateMath.ts`.
- **`<StampBadge>`** (`src/components/`): selo com rotação determinística (hash de string), 4 tokens de cor, ícone "baby", código bruto, marcador de relação sexual, label de Ápice.
- **Gráfico do ciclo** (`src/screens/chart/`): agrupamento por fase contígua (`chartGrouping.ts`, testado com saída real do rules-engine), scroll horizontal independente por fase, legenda fixa.
- **Fluxo de captura** (`src/screens/capture/`): 5 telas (Sangramento → Sensação [+ checkbox "Brilhante" condicional] → [Cor do muco → Elasticidade, só se não-Seco] → Relação sexual → Confirmação), navegação via React Navigation (native-stack), estado em `CaptureFlowContext`, dots de progresso e "← Voltar" testados como funções puras.
- **Navegação**: `RootNavigator` liga todas as telas; Confirmação leva ao gráfico; gráfico tem botão "Registrar hoje" pra reabrir o fluxo.
- **Botão de dev** (`DevSeedButton`, canto inferior direito, só em `__DEV__`): semeia um ciclo fake de 20 dias pra testar o gráfico sem precisar preencher manualmente.

**Testes:** 108 no total (59 rules-engine + 49 app). Typecheck limpo. Bundle real via Metro (`expo export --platform android`) validado com sucesso — confirma que o pacote ESM do workspace, SQLite, crypto e navegação resolvem corretamente.

## Decisões tomadas durante a Sprint 1 (não re-litigar)

- **Navegação:** React Navigation (native-stack), não Expo Router.
- **Localização:** `packages/app` (dentro do glob de workspaces existente).
- **Cor do muco na captura:** segue o protótipo de design (Transparente/Turvo/Branco/Amarelo claro/Com sangue), não a prosa do briefing. `MucusColor.BROWN` fica de fora da UI por enquanto — gap documentado no código (`MucusColorScreen.tsx`), motor de regras já suporta se precisar depois.
- **Biomarcador "Brilhante":** implementado (checkbox condicional na tela de Sensação) — o briefing já tinha isso como RESOLVIDO, mesmo com o `design/README.md` ainda listando como pendência (documento desatualizado nesse ponto específico).
- **Imports relativos em `packages/app`:** sem sufixo `.js` (diferente de `packages/rules-engine`, que usa a convenção NodeNext). Motivo: o Metro (bundler do React Native) não resolve `./arquivo.js` apontando para `arquivo.ts` — só imports sem extensão. Isso já causou um bundle quebrado nesta sessão; se algum arquivo novo em `packages/app` usar `.js` no import, o bundle vai falhar.
- **IDs e SQLite:** `expo-crypto`/`expo-sqlite` só são importados em arquivos "folha" (`db/id.ts`, `db/client.ts`) — os repositórios recebem `newId` por injeção de dependência pra continuarem testáveis no vitest sem depender do runtime nativo (importar `expo-crypto` direto quebra o parser do Vite, que não entende a sintaxe Flow do `react-native/index.js`).

## O que falta para fechar a Sprint 1

1. **Teste manual em dispositivo real** — não dá pra fazer num ambiente sem emulador/Mac. Passos:
   ```
   npm install                                          # na raiz do monorepo
   npm run build --workspace=@creighton/rules-engine    # rules-engine precisa estar buildado antes
   npm run start --workspace=@creighton/app
   ```
   Depois, no iPhone: app **Expo Go** da App Store, mesma rede Wi-Fi do Mac, escanear o QR code com a câmera nativa. Se a rede não conectar, usar `npx expo start --tunnel` (dentro de `packages/app`).
2. **Critério de aceite oficial da Sprint 1** (briefing Seção 5): registrar um ciclo completo (20+ dias) **offline** (modo avião), ver o gráfico clássico renderizado corretamente, sem nunca tocar rede. O botão de dev seed ajuda a simular os 20 dias rapidamente em vez de preencher um por um.
3. **Remover o botão de dev seed** (`src/components/DevSeedButton.tsx` e seu uso em `App.tsx`) depois que o teste manual estiver satisfatório.
4. Só depois disso a Sprint 1 está formalmente fechada e dá pra começar a Sprint 2 (backend + sync single-user).

## Onde olhar primeiro se for continuar em outra sessão/máquina

- `packages/app/src/navigation/RootNavigator.tsx` — ponto de entrada da navegação, lista todas as telas.
- `packages/app/src/screens/capture/CaptureFlowContext.tsx` — lógica de dots/back do fluxo de captura (funções puras, testadas).
- `packages/app/src/db/entryRepository.ts` — onde a captura de fato vira uma linha no SQLite (`recordEntry`).
- `packages/app/src/screens/chart/chartGrouping.ts` — regra de agrupamento por fase do gráfico.
- Este arquivo (`briefing/SPRINT1_PROGRESS.md`) deve ser atualizado ou removido quando a Sprint 1 fechar de verdade — não deixar ele ficar desatualizado como o `design/README.md` ficou em relação ao biomarcador Brilhante.
