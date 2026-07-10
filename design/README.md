# Handoff: Creighton Tracker — Design System + Sprint 1/3 Telas

## Overview
Diário clínico de casal baseado no método Creighton. Este pacote cobre: tokens de design, o componente de assinatura `<StampBadge>`, as telas do fluxo de captura diária (Sprint 1), o gráfico do ciclo (Sprint 1), os dashboards da Mulher e do Homem (Sprint 3, protótipo), e a marca/ícones do app.

## Sobre os arquivos de design
Os arquivos `.dc.html` na pasta `design_files/` são **referências de design construídas em HTML** — protótipos que mostram aparência e comportamento pretendidos, não código de produção para copiar diretamente. A tarefa é **recriar estes designs no ambiente real do projeto** (React Native + Expo, conforme o briefing original), usando NativeWind (se já estiver no projeto) ou `StyleSheet` com um `theme.ts` central — nada de hex/px soltos em componentes.

Cada `.dc.html` é auto-contido: abre direto no navegador (mostra o resultado renderizado) e também pode ser lido como código-fonte (HTML + uma classe de lógica JS no final do arquivo, sem build step) para entender estrutura, estado e interações.

## Fidelidade
**Alta-fidelidade (hifi)** para cores, tipografia, espaçamento e o componente `<StampBadge>` — os valores abaixo (Seção "Design Tokens") são finais e devem ser usados como estão. As telas de captura e os dashboards são protótipos interativos navegáveis (React state), então o comportamento (avançar ao tocar, navegação condicional, dots de progresso) também é final. Layout de listas/grids pode ser ajustado ao dispositivo real, mas a hierarquia visual e os componentes descritos aqui não devem mudar sem validação de design.

## Arquivos incluídos
- `design_files/Creighton Design System.dc.html` — showcase de todos os tokens (cores clínicas, paleta de apoio, tipografia, espaçamento/raio) + variações do `<StampBadge>`.
- `design_files/StampBadge.dc.html` — componente isolado do selo (o elemento de assinatura do produto). Props: `color` (red/green/white/yellow), `rawCode` (string), `intercourse` (bool), `peakLabel` (string, ex: "P", "P+1"), `daySeed` (string usada para a rotação determinística), `size` (px).
- `design_files/Creighton App.dc.html` — protótipo navegável: fluxo de captura (Telas 1–4/5 condicionais), gráfico do ciclo (agrupado por fase, com legenda), Dashboard Mulher, Dashboard Homem. Um seletor de abas no topo (fora do frame do celular) é só ferramenta de navegação do protótipo — não faz parte do app.
- `design_files/Creighton Brand Assets.dc.html` — logotipo (lockups horizontal, stacked, mark isolada) e preview dos ícones iOS/Android.
- `design_files/ios-frame.jsx` — bezel de iPhone usado só para apresentar o protótipo; não é parte do app.
- `brand_assets/icons/` — **arquivos de ícone prontos para uso**, já nos tamanhos corretos:
  - `ios/icon-1024.png` (App Store / asset mestre, quadrado, sem cantos arredondados — o iOS aplica a máscara) e `ios/icon-180.png` (@3x).
  - `android/adaptive-foreground-432.png` + `android/adaptive-background-432.png` (adaptive icon layers, mark dentro da safe zone central).
  - `android/playstore-512.png` (asset da Play Store) e `android/mipmap-*.png` (48/72/96/144/192, ícone legado achatado para versões pré-adaptive).

## Telas / Fluxos

### Fluxo de captura diária
- **Propósito**: registrar o dado do dia em menos de 10s, uma mão, toque grande, sem digitação.
- **Navegação**: cada tela é uma pergunta; tocar a opção já avança (exceto a tela de muco, que tem 2 perguntas — cor e elasticidade — em sequência antes de avançar). Dots de progresso no topo (não barra), contando 3 passos (sangramento → sensação → relação) ou 4 se a sensação não for "Seco" (insere a etapa de muco). Link discreto "← Voltar" navega para o passo anterior.
- **Telas**: Sangramento (5 opções) → Sensação (4 opções) → [Muco: cor (5 opções) → elasticidade (3 opções), só se sensação ≠ "Seco"] → Relação sexual (2 opções) → confirmação "Registrado".
- **Alvo de toque**: mínimo 48px de altura em cada opção — já implementado no protótipo, validar na implementação nativa (hit slop se necessário).
- **Pendência aberta**: biomarcador "Brilhante" (pergunta condicional extra na tela de Sensação) — não implementar até confirmação do Edu. O componente de tela já está estruturado para receber um passo extra sem retrabalho.

### Gráfico do ciclo
- Scroll horizontal por linha, dias agrupados por fase (Menstruação / Infértil / Fértil / Pós-Ápice), cada grupo com seu próprio scroll horizontal independente.
- Cada dia = `<StampBadge>` + número do dia do ciclo abaixo (fonte display/Fraunces). Marcador de Ápice (P, P+1...) aparece como etiqueta acima do selo, nunca sobrepondo.
- Legenda fixa no rodapé com selos pequenos (não swatches de cor soltos) explicando os 4 tokens.
- Dados vêm de fixture (simulando `@creighton/rules-engine`) — a UI não recalcula nada, só mapeia o token de cor já pronto.

### Dashboard Mulher
- Card do selo de hoje ancorado perto do topo (não centralizado na tela) + CTA "Registrar hoje" caso ainda não tenha sido registrado no dia. Link secundário para o gráfico completo. Esta é a tela de uso diário, não de consulta.

### Dashboard Homem
- Círculo central sólido na cor do token do dia (não usa `<StampBadge>` — informação densa demais para leitura de relance). Copy indireto abaixo (ex.: "hoje é um dia livre" / "hoje é um dia de atenção"; textos finais a validar com Edu). Botão discreto "Confirmar que vi".
- **Pendência aberta**: decisão sobre expor os 4 tokens completos ou simplificar para 2 estados. O componente já está parametrizado pelos 4 tokens — mais barato simplificar depois do que generalizar depois.

## Interações & Comportamento
- Toda navegação de tela é por toque em uma opção (sem botão "Próximo" separado), exceto a confirmação final do fluxo de captura, que tem um botão "Voltar ao início" explícito.
- Sem animações de transição elaboradas no protótipo — implementar com uma transição simples (fade/slide) é aceitável, não é um requisito de design.
- Sem estados de erro/validação — cada pergunta é seleção única obrigatória (sem campo livre), então não há validação de formulário a implementar aqui.

## Design Tokens

### Cores clínicas (fixas — só usar dentro do `<StampBadge>`)
- `--color-red`: `#E02424` — selo de sangramento
- `--color-green`: `#16A34A` — selo seco / infértil
- `--color-white`: `#FFFFFF` — selo de muco fértil (sempre com o ícone de "baby", nunca sozinho)
- `--color-yellow`: `#EAB308` — protocolo PIB / lactação

### Paleta de apoio
- `--color-paper`: `#F7F4EE` — fundo claro
- `--color-ink`: `#2B2A28` — texto principal
- `--color-ink-muted`: `#6B6862` — texto secundário / legendas
- `--color-paper-dark`: `#1C1B19` — fundo modo escuro (uso noturno)
- `--color-accent`: `#3B4C63` — interação (botões, links, foco, marca) — nunca compete com os tokens clínicos
- `--color-line`: `#D8D3C7` — hairlines, divisores, bordas de card

### Tipografia
- **Display**: Fraunces (500/600) — títulos de tela, número do dia do ciclo, wordmark. Google Fonts.
- **Corpo**: Inter (400/500/600) — texto de UI, labels, botões. Google Fonts.
- **Dado/utilitária**: IBM Plex Mono (500/600) — `raw_code` do selo. Google Fonts.

### Espaçamento & raio
- Escala de espaçamento (base 4px): 4 / 8 / 12 / 16 / 24 / 32 / 48
- `--radius-sm`: 6px (inputs, botões pequenos)
- `--radius-md`: 12px (cards)
- `--radius-stamp`: 4px (StampBadge — propositalmente menor que os outros, para parecer "colado")
- `--shadow-card`: `0 1px 3px rgba(43,42,40,0.08)`
- Alvo de toque mínimo: 48×48px em qualquer elemento do fluxo de captura.

### `<StampBadge>` — especificação de comportamento
- Quadrado, `radius-stamp` (4px).
- Rotação fixa por dia entre -3° e 3°, determinística a partir de um seed (usar a data do dia, não randômica a cada render — ver hash em `StampBadge.dc.html`).
- Sombra dupla: elevação baixa (`shadow-card`) + uma segunda sombra mais escura simulando espessura de papel colado.
- Conteúdo: cor de fundo = token clínico; ícone simples de "baby" (2 círculos) sobreposto quando `color = white`; `raw_code` no rodapé em IBM Plex Mono; símbolo "I" no canto quando `intercourse = true`; etiqueta de Ápice acima (fora do quadrado) quando aplicável.

## Marca / Ícones
- Mark = o mesmo quadrado do `StampBadge`, rotacionado -6°, cor accent (`#3B4C63`) sobre papel (ou invertido em fundo escuro), com um pequeno ponto central (referência ao selo de cera / carimbo).
- **Nunca** usar as 4 cores clínicas na marca ou nos ícones — só o accent.
- Ícones prontos em `brand_assets/icons/` (ver lista acima) — já nos tamanhos e formatos exigidos por cada plataforma, prontos para arrastar nas pastas de asset do Xcode / Android Studio.

## Não fazer (regras de negócio de UI)
- Não recalcular `computed_state` ou `peak_relation` na UI — vem pronto de `DAILY_FERTILITY_STATE` (`@creighton/rules-engine`). A UI só mapeia estado → token de cor.
- Não usar os 4 tokens clínicos fora do `<StampBadge>` (exceção explícita e única: o círculo do Dashboard do Homem, conforme especificado).
- Não usar marcadores numerados decorativos (01/02/03) fora do fluxo de captura.
- Não implementar a pergunta do biomarcador "Brilhante" nem a versão final do Dashboard do Homem até as pendências abertas serem confirmadas.

## Assets
- Fontes: Fraunces, Inter, IBM Plex Mono — todas via Google Fonts (ver `<link>` nos arquivos `.dc.html`).
- Ícone "baby" no StampBadge: 2 círculos simples via SVG inline (sem assets externos).
- Ícones de app: PNGs gerados neste pacote, em `brand_assets/icons/`.

## Arquivos
Ver `design_files/` (protótipos HTML) e `brand_assets/icons/` (ícones prontos para uso) nesta mesma pasta.
