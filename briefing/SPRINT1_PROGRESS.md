# Sprint 1 — Estado de Progresso

**Última atualização:** 2026-07-10
**Status:** FECHADA. Teste manual em dispositivo real (iPhone físico, via Expo Go/SDK 54) concluído em 2026-07-10, com 3 bugs reais encontrados e corrigidos (ver "Achados do teste manual" abaixo). Botão de dev seed removido.

Este documento existe para não perder o histórico entre máquinas: foi escrito na sessão que implementou a Sprint 1 num PC Windows, e o trabalho continuou num MacBook, onde o teste manual em dispositivo real aconteceu. O código e os commits do Git são a fonte da verdade; este arquivo é só o resumo de onde as coisas pararam.

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

## Achados do teste manual (2026-07-10) e correções aplicadas

O Expo Go da App Store estava travado no SDK 54 (Apple ainda não aprovou builds genéricos de SDK mais novo — ver `packages/app/AGENTS.md`), então `packages/app` foi rebaixado de SDK 57 para 54 para permitir o teste sem precisar de conta Apple Developer/Xcode. Além disso, um bug de sintaxe do próprio React Native 0.81.5 (`VirtualViewNativeComponent.js`, cast `as HostComponent<...>` que o codegen não processa) foi corrigido via `patch-package` (`patches/react-native+0.81.5.patch`, aplicado automaticamente no `postinstall`).

Testando o fluxo real (captura manual + botão de dev seed), 3 bugs de navegação/domínio foram encontrados e corrigidos:

1. **Fragmentação de ciclo:** `resolveCycleForNewEntry` (`src/domain/cycleBoundary.ts`) abria um ciclo novo a cada dia H/M, mesmo em dias consecutivos do mesmo fluxo menstrual — um período de vários dias virava vários "ciclos" separados, perdendo dias do gráfico ativo. Corrigido: só abre ciclo novo se o dia H/M vier depois de uma lacuna real (dia anterior não era H/M, ou não é o dia seguinte). Cobertura de teste adicionada em `cycleBoundary.test.ts` e `entryRepository.test.ts`.
2. **Gráfico não atualizava:** o botão de dev seed gravava no banco mas não navegava — se a pessoa já estivesse na tela do gráfico, ela continuava vendo dados desatualizados. Não se aplica mais (botão removido), mas o padrão de correção (navegação imperativa via `navigationRef`) ficou para casos futuros parecidos.
3. **App sempre abre na captura:** `RootNavigator` sempre iniciava em `Bleeding`, mesmo com o dia de hoje já registrado, obrigando a repetir o fluxo a cada abertura do app. Corrigido: `onReady` do `NavigationContainer` verifica se já existe registro de hoje no ciclo ativo e, se sim, pula direto pro gráfico (`redirectToChartIfAlreadyRegisteredToday` em `RootNavigator.tsx`).

Também corrigido um problema visual: as telas usavam padding fixo (`paddingTop: 66`, `spacing.xxl`) em vez de respeitar a área segura do dispositivo (notch/Dynamic Island, indicador de home) — `CaptureScreenLayout.tsx` e `ChartScreen.tsx` agora usam `useSafeAreaInsets()`.

## Fechamento

Critério de aceite oficial da Sprint 1 (briefing Seção 5) cumprido: ciclo completo (20 dias) registrado e visualizado corretamente em dispositivo real via Expo Go, com o motor de regras calculando os estados corretamente (validado card a card contra a tabela esperada). Botão de dev seed (`src/components/DevSeedButton.tsx`, `src/db/devSeed.ts`) removido. Sprint 2 (backend + sync single-user) pode começar.

## Onde olhar primeiro se for continuar em outra sessão/máquina

- `packages/app/src/navigation/RootNavigator.tsx` — ponto de entrada da navegação, lista todas as telas.
- `packages/app/src/screens/capture/CaptureFlowContext.tsx` — lógica de dots/back do fluxo de captura (funções puras, testadas).
- `packages/app/src/db/entryRepository.ts` — onde a captura de fato vira uma linha no SQLite (`recordEntry`).
- `packages/app/src/screens/chart/chartGrouping.ts` — regra de agrupamento por fase do gráfico.
- Este arquivo (`briefing/SPRINT1_PROGRESS.md`) deve ser atualizado ou removido quando a Sprint 1 fechar de verdade — não deixar ele ficar desatualizado como o `design/README.md` ficou em relação ao biomarcador Brilhante.
