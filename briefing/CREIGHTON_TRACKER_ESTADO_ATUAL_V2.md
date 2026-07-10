# CREIGHTON FAMILY TRACKER & GUIDE — Documento de Arquitetura e Produto
**Versão:** 1.0
**Status:** Base de trabalho para execução via Claude Code ("Snitch")
**Autor:** Arch (TPM/Arquitetura) — baseado em briefing de negócio de Edu
**Princípio inegociável do projeto:** Zero tolerância a erro de lógica. Em qualquer ambiguidade de dado, o sistema erra para o lado conservador: **FÉRTIL**.

---

## 0. COMO USAR ESTE DOCUMENTO

Este documento é a fonte de verdade do projeto. Ele separa claramente:
- **DECIDIDO** — pronto para implementação, sem debate.
- **DECISÃO DE EDU** — tecnicamente mapeado, mas exige escolha de negócio antes de codar.
- **RISCO SINALIZADO** — problema real no briefing original que foi corrigido ou precisa ser corrigido antes do MVP.
- **NUNCA CONSTRUIR AGORA** — está fora de escopo do MVP, mesmo que pareça fácil.

O Coder deve tratar a Seção 3 (Motor de Regras) como **especificação executável**: qualquer ambiguidade de implementação deve ser resolvida a favor do estado FÉRTIL, nunca a favor de "o que parece mais provável".

---

## 1. VISÃO DE PRODUTO E OS TRÊS HORIZONTES

### O que este produto realmente é
Não é um app de bem-estar. É um **instrumento clínico de apoio a decisão reprodutiva**, usado por casais sob orientação de instrutora credenciada Creighton. Isso muda tudo: a barra de qualidade não é "product-market fit rápido", é "o app nunca pode dizer FÉRTIL quando é INFÉRTIL — o inverso é aceitável, o direto é inaceitável". Uma tabela de decisão errada aqui não é um bug de produto, é um evento com consequência reprodutiva real para um casal. Isso deve guiar toda priorização.

### Horizonte 1 — Construir agora (MVP validável)
- Motor de Regras Creighton (MRE) como módulo determinístico, testável isoladamente, sem UI.
- VDRS: entrada diária guiada (single-user, sem parceiro ainda).
- Cálculo de estado de fertilidade diário e Dia Ápice retrospectivo.
- Gráfico Creighton clássico (visualização, mesmo que não perfeita pixel-a-pixel ainda).
- Autenticação simples (email/senha) — sem dual-sync ainda.
- Persistência local-first com sync simples (last-write-wins aceitável no MVP, com ressalva — ver Seção 5).

### Horizonte 2 — Projetar agora, construir depois
- Dual-sync casal (Homem/Mulher) com resolução de conflito real.
- Modo Lactação e Modo Pré-Menopausa (variantes clínicas).
- Exportação PDF com senha para instrutora/médico NaPro.
- Push notifications (FCM) para o parceiro.
- Modo de privacidade granular (parceiro vê só status resumido).

### Horizonte 3 — Nunca construir internamente (ou não agora)
- Criptografia E2E "caseira". Se isso for requisito real (ver Seção 6), **usar biblioteca auditada** (libsodium/Signal Protocol patterns), nunca implementação própria de AES. Isso é o tipo de coisa que parece 2 dias de trabalho e é na verdade um projeto de segurança inteiro, com risco legal se malfeito.
- Qualquer forma de predição estatística de ciclo (tabelinha/Ogino-Knaus). O briefing já exclui isso corretamente — reforço aqui porque é tentador adicionar "só como fallback de UX" e isso quebraria o posicionamento clínico do produto inteiro.
- IA/ML para sugestão de classificação de muco a partir de foto. Fora de escopo, risco regulatório alto (viraria dispositivo médico classificado), e o método é literalmente sobre observação humana treinada — automatizar isso destrói a proposta de valor.

---

## 2. MODELO DE DADOS (revisado)

O modelo original do briefing tem uma falha estrutural: trata `system_fertility_state` como fato armazenado em `DAILY_ENTRY`, mas o próprio método exige que esse estado seja **recalculado retroativamente** quando o Ápice é confirmado. Se você faz UPDATE in-place nesse campo, perde o histórico do que o app efetivamente comunicou ao casal em cada dia — que é o dado mais sensível de responsabilidade clínica que existe no produto.

**Decisão:** separar dado observado (imutável) de estado derivado (recalculável e versionado).

```
┌─────────────────────────────────────────────────────────────────┐
│                              USER                                │
├─────────────────────────────────────────────────────────────────┤
│ id: UUID (PK)                                                     │
│ email: String                                                     │
│ role: Enum (PRIMARY_OBSERVER / COOP_PARTNER)                      │
│ partner_id: UUID (FK -> USER.id, nullable)                        │
│ current_variant_mode: Enum (REGULAR / LACTATION / MENOPAUSE / BIP)│
│ instructor_credential_ack: Boolean  ← aceite do disclaimer clínico│
└──────────────────────────────────┬────────────────────────────────┘
                                    │ 1
                                    │ *
┌──────────────────────────────────▼────────────────────────────────┐
│                              CYCLE                                 │
├─────────────────────────────────────────────────────────────────────┤
│ id: UUID (PK)                                                        │
│ user_id: UUID (FK)                                                   │
│ start_date: Date                                                     │
│ end_date: Date (nullable)                                            │
│ is_active: Boolean                                                   │
│ variant_mode_snapshot: Enum   ← modo vigente no início do ciclo      │
│ confirmed_peak_day: Date (nullable)                                  │
│ peak_day_confirmed_at: Timestamp (nullable) ← QUANDO foi confirmado, │
│                                                não apenas qual dia    │
└──────────────────────────────────┬────────────────────────────────┘
                                    │ 1
                                    │ *
┌──────────────────────────────────▼────────────────────────────────┐
│                           DAILY_ENTRY  (dado bruto, imutável)       │
├─────────────────────────────────────────────────────────────────────┤
│ id: UUID (PK)                                                        │
│ cycle_id: UUID (FK)                                                  │
│ date: Date                                                           │
│ bleeding_type: Enum (H, M, L, VL, B, NONE)                           │
│ mucus_sensation: Enum (DRY, DAMP, WET, LUBRICATIVE)                  │
│ mucus_stretch: Enum (NONE, STICKY, TACKY, ELASTIC)  ← 6/8/10 do VDRS │
│ mucus_color: Enum (CLEAR, CLOUDY, CLOUDY_CLEAR, YELLOW, BROWN, RED)  │
│ shiny_reflex: Boolean  ← RESOLVIDO 10/07: biomarcador código 4       │
│ raw_code: String   ← ex "8CX2", literal do selo, gerado, não digitado│
│ intercourse: Boolean                                                 │
│ peak_override_by_instructor: Boolean                                 │
│ entered_at: Timestamp                                                │
│ entry_source: Enum (USER / INSTRUCTOR_CORRECTION)                    │
│ UNIQUE(cycle_id, date)                                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │ 1
                                    │ 1
┌──────────────────────────────────▼────────────────────────────────┐
│                    DAILY_FERTILITY_STATE (derivado, versionado)     │
├─────────────────────────────────────────────────────────────────────┤
│ id: UUID (PK)                                                        │
│ daily_entry_id: UUID (FK)                                            │
│ computed_state: Enum (FERTILE, INFERTILE_ALTERNATING,                │
│                        INFERTILE_ABSOLUTE)                           │
│ peak_relation: Enum (PRE_PEAK / CANDIDATE / P / P1 / P2 / P3 / P4_PLUS│
│                        / NOT_APPLICABLE)                              │
│ computed_at: Timestamp                                               │
│ rule_engine_version: String   ← rastreabilidade: qual versão do MRE  │
│ superseded_by: UUID (FK -> DAILY_FERTILITY_STATE.id, nullable)       │
│   ← se um recálculo retroativo mudar o estado, o registro antigo     │
│     NÃO é apagado, é marcado como superseded. Isso é o log de        │
│     auditoria clínico-legal do produto.                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Por que isso importa na prática:** quando o Ápice é confirmado em D+3, o motor recalcula D, D+1, D+2 e D+3 e **insere novos registros** em `DAILY_FERTILITY_STATE`, apontando os antigos como `superseded_by`. A UI sempre lê o registro mais recente (`superseded_by IS NULL`). Isso custa uma tabela extra e uma query levemente mais complexa. O que compra: histórico auditável de "o que dissemos ao casal, e quando mudamos de ideia" — que qualquer instrutora Creighton vai perguntar se o app tiver um incidente.

**RISCO SINALIZADO (briefing original):** o campo `mucus_stretch` do briefing tinha só `NONE/STICKY/TACKY/ELASTIC`, mas a tabela VDRS descreve 8 códigos distintos (0, 2, 2W, 4, 6, 8, 10, 10DL) com regras de estiramento em cm específicas. Comprimi isso em `mucus_stretch` (categoria clínica) + `raw_code` (literal do selo, para o gráfico). O Coder **não deve inferir o código literal livremente** — a tabela de mapeamento sensação+estiramento+cor → código está na Seção 3.1 abaixo e deve ser tratada como lookup fechado, não heurística.

---

## 3. MOTOR DE REGRAS CREIGHTON (MRE) — Especificação Executável

### Princípios de implementação (não-negociáveis)
1. O MRE é uma função pura: `(histórico_de_entradas_do_ciclo, variant_mode) → DAILY_FERTILITY_STATE[]`. Sem I/O, sem chamada de rede, 100% testável com fixtures.
2. Qualquer campo ausente ou combinação não mapeada na tabela de decisão → **FERTILE**. Sem exceção, sem "provavelmente é infértil". Isso deve estar coberto por teste automatizado desde o dia 1 (ver Seção 7).
3. O motor roda **duas vezes** por entrada nova: uma vez forward (calcula o dia de hoje) e, quando aplicável, um recálculo retroativo em cascata (ver 3.3). Cada execução gera novos registros versionados, nunca sobrescreve.

### 3.1. Tabela de Lookup VDRS → Código Literal (fechada)

| sensation | stretch | color | → raw_code | → fertility_tier |
|---|---|---|---|---|
| DRY | NONE | — | `0` | Infértil (potencial) |
| DAMP | NONE | — | `2` | Infértil (potencial) |
| WET | NONE | — | `2W` | Fértil (alerta) |
| (qualquer) | NONE + `shiny_reflex=true` | — | `4` | Fértil (alerta) |
| (qualquer) | STICKY | + cor | `6[cor]` | Fértil |
| (qualquer) | TACKY | + cor | `8[cor]` | Fértil |
| (qualquer) | ELASTIC | + cor | `10[cor]` | Altamente fértil |
| LUBRICATIVE | NONE | — | `10DL` | Altamente fértil |

**RESOLVIDO 10/07:** o biomarcador "Brilhante" (código 4) tem campo próprio `shiny_reflex: boolean` em `DAILY_ENTRY` (Seção 2). Capturado via checkbox condicional na tela de Sensação (ver Seção 9.2, atualizada) — o fluxo de captura permanece em 4 telas, não vira 5.

Cor é sufixo do código (`C`=Clear, `K`=Cloudy, `Y`=Yellow, `B`=Brown, `R`=Red), combinável (ex: `8CX2` do exemplo do briefing = múltiplas observações do dia — mas o app captura só o pico do dia, então o sufixo composto não deveria ocorrer no MVP; se aparecer no gráfico exportado é porque a instrutora anotou manualmente. Confirmar com Edu se o app precisa suportar múltiplas observações por dia ou só o "pico do dia" como está descrito em 2.1).

### 3.2. Identificação do Dia Ápice (Peak Day) — máquina de estados

Estados possíveis do "rastreador de ápice" por ciclo: `NONE`, `CANDIDATE(date)`, `CONFIRMED(date)`.

```
Ao processar entrada do dia D:

1. Se bleeding_type ∈ {H, M} → bloqueia qualquer confirmação de ápice neste dia.
   (não impede que um Tc já candidato siga aguardando confirmação em dias futuros,
   mas o próprio dia D não pode ser candidato nem confirmar nada)

2. Se raw_code ∈ {peak-type: color=CLEAR, stretch=ELASTIC, sensation=LUBRICATIVE}:
     tracker = CANDIDATE(D)   // sempre substitui candidato anterior

3. Se tracker == CANDIDATE(Tc) e D > Tc:
     Se D é "não-pico" (ver definição abaixo) E isso persiste por 3 dias
     consecutivos a partir de Tc+1 (ou seja, Tc+1, Tc+2, Tc+3 todos não-pico):
        tracker = CONFIRMED(Tc)
        → dispara recálculo retroativo (Seção 3.3)
     Senão se D apresenta novo padrão "tipo pico":
        tracker = CANDIDATE(D)   // descarta Tc anterior, reinicia contagem
     Senão (dia ainda ambíguo, ex: só 1 ou 2 dias de não-pico até agora):
        tracker permanece CANDIDATE(Tc), estado do dia D = FERTILE (default seguro)

Definição de "não-pico": raw_code ∉ {C, 10, 10DL, ELASTIC-qualquer-cor} 
  E sensation != LUBRICATIVE
```

**RESOLVIDO 10/07 — regra travada para Sprint 0:** confirmação exige **3 dias consecutivos de padrão não-pico** (Tc+1, Tc+2, Tc+3), não 24h. Essa é a regra clínica padrão publicada do método e a que aparece no fluxograma detalhado do briefing — a menção a "24h" era uma inconsistência do texto original, não uma alternativa válida. Nenhuma implementação de 24h deve ser considerada. O teste de aceite do motor de regras (Sprint 0) usa esta regra como gate: sem ela passando, a sprint não é considerada fechada.

### 3.3. Recálculo Retroativo em Cascata

Quando `tracker` transiciona para `CONFIRMED(Tc)`:
1. Marcar `Cycle.confirmed_peak_day = Tc`, `peak_day_confirmed_at = now()`.
2. Para cada `DAILY_ENTRY` do ciclo com `date >= Tc`: recalcular `peak_relation` (P, P+1, P+2, P+3, P+4_PLUS conforme distância de Tc) e `computed_state` conforme regra de intimidade (3.4).
3. Para cada `DAILY_ENTRY` com `date < Tc` que teve `computed_state` calculado sob um `tracker` diferente (ex: um Tc anterior descartado): **não alterar** — o passado antes do Tc confirmado já foi corretamente FÉRTIL sob a fase de muco, isso não muda retroativamente.
4. Inserir novos registros em `DAILY_FERTILITY_STATE` para os dias afetados; apontar os registros antigos correspondentes via `superseded_by`.

### 3.4. Regra de Intimidade — Estados de Fertilidade Diária

```
INÍCIO DE CICLO (bleeding H/M) 
  → estado = FERTILE
  (fluxo pode mascarar muco; nunca classificar como infértil aqui,
   mesmo que o histórico sugira fase seca habitual)

FASE PRÉ-ÁPICE, sem muco tipo-pico ainda, sem candidato a Ápice ativo:
  → Regra do Dia Alternado:
     - Se D-1 teve intercourse == true → estado(D) = FERTILE (obrigatório,
       independente de qualquer outro dado — sêmen mascara observação)
     - Se D-1 teve estado FERTILE (por qualquer motivo) → estado(D) = FERTILE
     - Senão, se D é seco/infértil-potencial (raw_code 0 ou 2) 
       → estado(D) = INFERTILE_ALTERNATING
     - Qualquer ambiguidade → FERTILE

PRIMEIRO SINAL DE MUCO (qualquer raw_code != 0/2) OU bleeding L/VL:
  → estado = FERTILE (permanece assim durante toda a fase de muco,
     incluindo período de candidato a Ápice não confirmado)

APÓS ÁPICE CONFIRMADO (Tc = P):
  P, P+1, P+2, P+3 → estado = FERTILE (janela de segurança obrigatória)
  P+4 em diante → estado = INFERTILE_ABSOLUTE
     (permitido dia e noite consecutivos até o início do próximo ciclo,
      OU até sangramento de interrupção — ver regra abaixo)

SANGRAMENTO DE INTERRUPÇÃO (fora do período menstrual principal, 
  em qualquer fase, inclusive INFERTILE_ABSOLUTE):
  → estado = FERTILE no dia do sangramento + 3 dias adicionais de
     secagem completa (raw_code 0) após o fim do sangramento
  → NÃO fecha o ciclo automaticamente (isso só ocorre com menstruação
     de fluxo H/M real — ver Seção 3.5, variante pré-menopausa)
```

### 3.5. Variantes Clínicas

**Lactação (`variant_mode = LACTATION`):**
- Primeiros 15 dias do modo: sem cálculo de fertilidade utilizável para intercurso — força tela de "fase de observação, abstinência recomendada", sem cálculo de PIB ainda.
- A partir do dia 16: se os últimos 3 `raw_code` consecutivos forem idênticos (mesma sensação + stretch + cor) → estabelece `PIB` (Padrão Infértil Básico) = esse raw_code. Selo passa a ser amarelo (`YELLOW_STAMP`), estado = `INFERTILE_ALTERNATING` (segue a mesma regra de dia alternado, nunca `INFERTILE_ABSOLUTE` sob PIB — o método não permite dias consecutivos sob protocolo de selos amarelos).
- Qualquer entrada que desvie do PIB estabelecido (raw_code diferente) → estado = `FERTILE` imediatamente para aquele dia, e reinicia a contagem de 3 dias para reestabelecer um novo PIB.

**Pré-menopausa (`variant_mode = MENOPAUSE`, ciclos > 38 dias):**
- `Cycle.end_date` não é setado automaticamente por tempo decorrido. Só fecha com bleeding_type ∈ {H, M} real.
- Múltiplos `CANDIDATE(Tc)` podem coexistir na timeline sem invalidar os anteriores até que um deles seja de fato confirmado.
- Confirmação de Ápice verdadeiro exige adicionalmente: menstruação real ocorre entre 8 e 16 dias após P+4 desse candidato. Se a menstruação vier fora dessa janela, aquele Tc **nunca é confirmado como Ápice** — permanece como candidato descartado, e o ciclo continua em fase pré-Ápice até novo candidato satisfazer a condição.
- **RESOLVIDO 10/07:** o app aceita o estado pendente de até 16 dias como comportamento esperado, não como falha de UX. Tela exibe label informativo **"Ciclo longo sob monitoramento"** enquanto `tracker = CANDIDATE` sem confirmação. Nenhuma comunicação de "erro" ou "atraso" — é o funcionamento correto da variante. Este label específico deve ser tratado como copy final, não placeholder, no componente de UI correspondente (Sprint 4).

---

## 4. ARQUITETURA TÉCNICA — DECISÕES E TRADE-OFFS

### 4.1. Stack (decidido por Edu em 10/07)

| Camada | Recomendação | Por quê (para projeto solo, AI-assisted) |
|---|---|---|
| Mobile | React Native + Expo | Um único Coder mantendo iOS+Android nativos separados não é viável. RN com Expo reduz superfície de configuração nativa, tem ecossistema maduro pra offline-first (WatermelonDB, MMKV). |
| Motor de Regras | TypeScript puro, pacote isolado (`@creighton/rules-engine`) | Sem dependência de framework. Pode rodar em teste unitário puro, e futuramente ser reusado em backend para validação cruzada (ver 4.3). Isso é a parte mais crítica do produto — precisa poder ser testada sem subir app nem servidor. |
| Persistência local | SQLite (via `expo-sqlite` ou WatermelonDB) | Offline-first de verdade exige banco relacional local, não AsyncStorage. Preserva `UNIQUE(cycle_id,date)` e permite queries de histórico para o motor de regras. |
| Backend | Node.js + Express, PostgreSQL puro, deploy em Railway | **Decisão de Edu:** manter o mesmo padrão operacional do 100 Days Plan da IBF — um único sistema de deploy, um único lugar pra debugar infra. Isso troca a conveniência do Supabase (Auth+Realtime+DB integrados) por controle total e consistência com o resto do portfólio. |
| ORM/Migrations | Prisma (recomendado) ou Drizzle | Com Postgres puro, migração de schema deixa de ser automática (Supabase Studio) e vira responsabilidade explícita. Prisma dá schema declarativo + migration history versionada em Git — importante porque o modelo da Seção 2 (versionamento de `DAILY_FERTILITY_STATE`) depende de constraints bem definidas (`UNIQUE`, FKs), e isso precisa estar documentado como código, não como configuração manual num painel. |
| Autenticação | Implementação própria (JWT + bcrypt) ou Auth.js/Lucia adaptado a Express | Sem Supabase Auth, isso vira código seu. Recomendo **não reinventar** — usar uma lib madura (Lucia Auth ou Auth.js com adapter Postgres) em vez de JWT manual, porque autenticação malfeita é a categoria de bug mais cara que existe e é fácil de errar sutilmente (expiração de token, refresh, hash de senha). |
| Realtime dual-sync | **Adiado para Sprint 3 por design, não por limitação técnica** | Como o dual-sync já era Horizonte 2 (Seção 1), e ele exigiria WebSocket próprio (Postgres `LISTEN/NOTIFY` + camada de socket, ex: `ws` ou Socket.IO) sem o bundle do Supabase Realtime, a decisão de Postgres puro reforça adiar isso: nas Sprints 0–2 (single-user), sync por **polling simples** (`GET /sync?since=timestamp`) resolve com uma fração da complexidade de manter conexão persistente. WebSocket só entra quando o dual-sync realmente precisar de latência baixa entre os dois dispositivos. |

**Trade-off que você está assumindo conscientemente ao escolher Postgres puro em vez de Supabase:** ganha consistência operacional (um Railway só, um dashboard de logs só, reuso do que você já sabe operar) e paga com mais código próprio pra Auth e pra Realtime — que no Supabase viriam prontos. Dado que dual-sync é Horizonte 2 mesmo, esse custo só aparece de fato na Sprint 3, não agora. Vale registrar: Railway Postgres não tem PITR (point-in-time recovery) automático como o Supabase — para dado de saúde sensível, configurar backup automático (Railway tem backup nativo pago, ou `pg_dump` agendado) é item de Sprint 2, não opcional.

### 4.2. Offline-first + Dual-Sync: resolução de conflito (o problema que o briefing não resolve)

O briefing pede offline-first **e** sync em tempo real via websocket, sem definir o que acontece quando os dois colidem. Proposta:

- `DAILY_ENTRY` é **append-only por natureza de negócio** (você não corrige uma observação passada, você registra uma nova observação para uma nova data, ou uma correção explícita de instrutora com `entry_source = INSTRUCTOR_CORRECTION`). Isso elimina 90% do problema de merge: não há "duas versões conflitantes do mesmo dia" no fluxo normal, porque `UNIQUE(cycle_id, date)` é respeitado no cliente antes mesmo de tentar sync — o dia de hoje só é escrito uma vez.
- Sync é fila local (outbox pattern): toda entrada offline vai para uma fila local com timestamp de criação; ao reconectar, sobe em ordem via `POST /entries`; servidor rejeita duplicata por `UNIQUE(cycle_id,date)` com erro idempotente (silencioso pro usuário). Distribuição de volta para os clientes é via **polling** (`GET /sync?since=timestamp`) nas Sprints 0–2 — sem necessidade de conexão persistente enquanto for single-user.
- O `DAILY_FERTILITY_STATE` (derivado) **nunca é calculado no cliente do parceiro**. Só o dispositivo da Mulher roda o motor de regras localmente (porque só ela tem os dados brutos, inclusive em modo de privacidade). O servidor recebe o `DAILY_ENTRY`, também roda o motor de regras (mesma lib, reusada — ver 4.3) como fonte de verdade, e distribui o `DAILY_FERTILITY_STATE` resultante via polling (Sprint 2) ou WebSocket próprio sobre `LISTEN/NOTIFY` do Postgres (Sprint 3, quando latência baixa entre os dois dispositivos passar a importar de fato). Isso resolve o risco #3 que sinalizei no início: não existem "dois relógios" calculando fertilidade — só um, no servidor, alimentado por dado que pode chegar atrasado mas nunca em conflito.

### 4.3. Por que o motor de regras deve rodar no servidor, não só no cliente

Isso é uma mudança relevante frente ao que o briefing sugere implicitamente (app com motor local, sync do resultado). Rodar o MRE **também** no servidor, com a mesma lib TypeScript compartilhada (via pacote npm interno ou monorepo), garante que:
1. O parceiro nunca vê um estado calculado por uma versão de app desatualizada no celular dela.
2. Recalcular retroativamente em cascata (3.3) é uma operação server-side transacional — evita duas fontes tentando reescrever histórico ao mesmo tempo.
3. Abre caminho natural para a exportação de PDF clínico (Horizonte 2) ser gerada server-side, sem depender do estado local do celular estar íntegro.

**Trade-off aceito:** isso significa que o app não é 100% "funciona void de servidor para sempre" — em modo totalmente offline por múltiplos dias, o app pode mostrar um estado calculado localmente como "provisório" até sincronizar, com indicador visual claro de "não confirmado pelo servidor". Isso é aceitável e, dado o princípio de segurança do produto, é preferível a divergência silenciosa entre dispositivos.

---

## 5. SEQUENCIAMENTO DE PRODUTO (Sprints)

Cada entrega tem critério de sucesso explícito. Nenhuma sprint avança sem o critério anterior atendido — isso não é burocracia, é o mecanismo que impede "parece que funciona" de virar "está em produção".

### Sprint 0 — Motor de Regras isolado (sem UI, sem banco)
**O que constrói:** pacote `@creighton/rules-engine` em TypeScript puro. Funções para lookup VDRS→raw_code, tracker de Ápice, cálculo de estado diário, recálculo retroativo.
**O que valida:** que a lógica clínica está correta antes de gastar 1 hora de UI em cima dela.
**Critério de sucesso:** suite de testes cobrindo — (a) todos os casos de tabela de lookup, (b) confirmação de Ápice em 3 cenários (confirmação limpa, descarte de candidato, sangramento bloqueando), (c) regra do dia alternado com intercurso, (d) todo campo ausente/nulo resulta em FERTILE, (e) pelo menos um ciclo completo simulado ponta-a-ponta batendo com um exemplo de gráfico Creighton real (pedir para Edu validar com instrutora ou fonte confiável — isso é dado de teste, não estético).
**O que isso destrói se estiver errado:** tudo. Esta é a única sprint onde um erro não detectado se propaga silenciosamente para o produto inteiro.

### Sprint 1 — Captura de dados + persistência local
**O que constrói:** telas de entrada rápida (Seção 4.2 do briefing original — fluxo binário), SQLite local, ligação com o motor de regras rodando localmente.
**Critério de sucesso:** uma usuária consegue registrar um ciclo completo (20+ dias) offline, ver o gráfico clássico renderizado corretamente, sem nunca tocar rede.
**O que isso valida:** se o fluxo de captura de <10s é realmente rápido o suficiente na prática (cronometrar com usuário real, não achismo).

### Sprint 2 — Backend + sync single-user (sem parceiro ainda)
**O que constrói:** Supabase schema, outbox de sync, motor de regras replicado server-side, autenticação.
**Critério de sucesso:** dado inserido offline aparece corretamente no servidor após reconectar, sem duplicar, sem sobrescrever incorretamente estado retroativo.
**Nota:** dual-sync com parceiro **não entra aqui**. Validar single-user primeiro é o que separa um MVP sério de um MVP que parece pronto mas tem a fundação de sync quebrada.

### Sprint 3 — Dual-sync casal
**O que constrói:** vínculo `partner_id`, dashboard do Homem (widget de status), Realtime, modo de privacidade (parceiro só vê status resumido).
**Critério de sucesso:** dois dispositivos reais, testados por um casal de verdade (não simulação), confirmando que o status aparece correto e a tempo em ambos.

### Sprint 4 — Exportação clínica + variantes (Lactação/Pré-menopausa)
**Adiada intencionalmente para depois de validação em ciclo regular.** Construir variantes clínicas antes de validar o caso regular é resolver o problema mais raro antes do mais comum — e são justamente as variantes que mais concentram risco de erro de lógica.

---

## 6. SEGURANÇA E PRIVACIDADE (revisão da proposta do briefing)

O briefing pede "classe HIPAA e LGPD compatível" com AES-256 "baseado no ID de usuário" no Firestore. Isso precisa ser desmontado em decisões reais:

**Decisão fechada por Edu em 10/07: segurança padrão de provedor no MVP.** E2E encryption fica formalmente em Horizonte 2/3 — não é omissão, é débito técnico assumido conscientemente (registrado também na Seção 7). Isso significa: sem "esqueci minha senha = perco meus dados" no MVP, e sem promessa de zero-knowledge para os primeiros usuários. Se em algum momento isso for comunicado como diferencial de marketing, precisa estar tecnicamente implementado primeiro — não anunciar E2E antes de existir.

1. **Criptografia em trânsito e em repouso (padrão do MVP):** TLS entre app e API + criptografia em disco do volume Postgres no Railway. Isso cobre "alguém rouba o disco do datacenter" ou intercepta a conexão; não cobre "alguém com acesso ao banco lê os dados brutos" — e no MVP isso é aceitável porque esse "alguém" é você mesmo/backend próprio, não um terceiro custodiante de infraestrutura compartilhada como seria com um provedor gerenciado.
2. **Nota para quando E2E entrar em pauta (Horizonte 2/3, não agora):** se o requisito futuro for "nem admin do banco lê o dado bruto", isso exige derivar chave localmente a partir de senha do usuário (ex: libsodium/argon2id) e armazenar só dado cifrado no servidor — com o trade-off de recuperação de senha citado acima. Mantenho isso documentado para não ser redescoberto do zero quando a demanda aparecer.
3. **HIPAA não se "aplica" por escolha de arquitetura — é uma classificação regulatória americana que depende de quem processa o dado (covered entity/business associate).** Não vou deixar essa afirmação do briefing passar sem qualificação: se o app não integra com provedores de saúde americanos formalmente, "compatível com HIPAA" é uma alegação de marketing, não um status legal. Recomendo tratar como "seguimos princípios de segurança equivalentes a dado de saúde sensível" e não afirmar conformidade formal sem revisão jurídica.
4. **LGPD é aplicável de fato** (dado de saúde é dado sensível sob art. 5º, II) — isso exige, na prática: consentimento explícito e granular, possibilidade de exportação e exclusão de dados a pedido da usuária, e minimização de dado exposto ao parceiro (o briefing já acerta nisso ao propor status resumido em vez de detalhe bruto).
5. **PDF com senha (Seção 6.3 do briefing):** viável e correto como está proposto — geração server-side, senha definida no momento da exportação, sem persistir a senha em lugar nenhum.

---

## 7. VALIDAÇÃO E DÉBITO TÉCNICO CONSCIENTE

### O que precisa de validação clínica externa (não é decisão de produto, é decisão de correção)
- A sequência completa de teste do motor de regras (Sprint 0) deveria, idealmente, ser revisada por uma instrutora Creighton credenciada ou confrontada com um caso real documentado, antes de considerar o MVP "pronto para casais reais". Isso não é apenas para a Sprint 0 — qualquer mudança futura no motor de regras deveria passar pelo mesmo crivo. Recomendo formalmente isso como gate de lançamento, não como nice-to-have.

### Débito técnico assumido conscientemente no MVP (e por quê é aceitável agora)
- Last-write-wins na sync single-user (Sprint 2) é aceitável porque `UNIQUE(cycle_id,date)` já previne o cenário mais perigoso (sobrescrever observação de um dia diferente). O único conflito possível é "o mesmo dia editado duas vezes rapidamente no mesmo dispositivo" — baixo risco, aceitável para MVP.
- E2E encryption fica em Horizonte 2/3 (decisão fechada na Seção 6) — documentado como débito técnico aceito, não decisão silenciosa.

---

## 8. DECISÕES PENDENTES DE EDU (bloqueiam início de sprints específicas)

**Todas as pendências abaixo foram resolvidas por Edu em 10/07. Nenhuma decisão de negócio segue bloqueando Sprint 0, 1 ou 3.**

1. ~~**Biomarcador "Shiny" (código 4)**~~ — **RESOLVIDO:** campo `shiny_reflex: boolean` incluído em `DAILY_ENTRY` (Seção 2), capturado via checkbox condicional na Tela de Sensação (Seção 9.2), fluxo permanece em 4 telas.
2. ~~**Confirmação de Ápice: 3 dias vs 24h**~~ — **RESOLVIDO:** regra travada em 3 dias consecutivos de padrão não-pico. Gate de aceite da Sprint 0.
3. ~~**UX do modo pré-menopausa (até 16 dias de espera)**~~ — **RESOLVIDO:** aceito como comportamento esperado, label "Ciclo longo sob monitoramento" (Seção 3.5).
4. ~~**Nível de criptografia**~~ — **RESOLVIDO 10/07:** padrão de provedor (TLS + at-rest) no MVP, E2E adiado para Horizonte 2/3.
5. ~~**Confirmar stack**~~ — **RESOLVIDO 10/07:** PostgreSQL puro, deploy via Railway (consistência com o restante do portfólio de Edu). Auth e Realtime deixam de vir prontos (eram bundle do Supabase) e passam a ser responsabilidade explícita do Coder — ver Seção 4.1 atualizada.
6. ~~**Dashboard do parceiro — 4 tokens vs. simplificado**~~ — **RESOLVIDO:** backend expõe os 4 tokens completos; simplificação é só de copy, nunca de dado ou cor (Seção 9.1).
7. ~~**Biomarcador Brilhante no fluxo de captura**~~ — **RESOLVIDO:** mesma resposta da pergunta 1 — checkbox na Tela 2, sem tela extra.

---

## 9. DESIGN SYSTEM & UX — ESPECIFICAÇÃO PARA IMPLEMENTAÇÃO

### 9.1. Tokens de cor (fixos — não são decisão de design, são padrão clínico do método)

| Token | Hex | Uso |
|---|---|---|
| RED | `#E02424` | Selo de sangramento (menstruação ou intercorrente) |
| GREEN | `#16A34A` | Selo seco — infértil |
| WHITE + ícone BABY | `#FFFFFF` | Selo de muco fértil |
| YELLOW | `#EAB308` | Selo amarelo (protocolo PIB, comum em lactação) |
| DARK GREY / LIGHT BEIGE | `#1F2937` / `#FDFBF7` | Fundo e texto, contraste para inserção noturna |

**Implicação técnica direta:** esses 4 tokens de cor devem ser derivados do `computed_state` + `raw_code` no momento da renderização, nunca armazenados como cor no banco — cor é apresentação, não dado. O mapeamento `computed_state → token` fica: `INFERTILE_ALTERNATING/ABSOLUTE` sem selo amarelo ativo → GREEN; `FERTILE` → WHITE+baby; `bleeding_type != NONE` → RED (tem precedência visual sobre os outros, é o selo do dia); PIB ativo em Lactação → YELLOW mesmo com `computed_state = INFERTILE_ALTERNATING`. Essa é uma regra de UI com lógica própria — vale um teste de snapshot dedicado, separado dos testes do motor de regras.

**RESOLVIDO 10/07:** o backend envia **os 4 tokens de cor completos** (RED, GREEN, WHITE, YELLOW) no contrato de dados do dashboard do parceiro — não há simplificação na camada de dado. A simplificação acontece **só no texto de apoio da interface** (Seção 9.3, Dashboard do Homem), nunca no dado nem na cor exibida. Isso significa que o componente de círculo de status já nasce parametrizado pelos 4 tokens desde a Sprint 3 — não há versão "2 estados" a ser generalizada depois.

### 9.2. Fluxo de entrada diária (Sprint 1 — captura em <10s)

Sequência fixa de telas, binária, sem decisões compostas na mesma tela:
1. Sangramento (Não / Muito Leve / Leve / Moderado / Intenso)
2. Sensação (Seco / Úmido / Molhado / Lubrificante) — **RESOLVIDO 10/07:** inclui checkbox condicional "o papel refletiu luz?" (`shiny_reflex`) quando sensação = Seco ou Úmido. Fica na mesma tela, não é uma tela nova.
3. Características de muco — **só aparece se sensação != Seco**: cor (Transparente/Turvo/Esbranquiçado/Amarelo/Marrom) + teste dos dedos (não esticava / esticava um pouco / esticava bastante)
4. Relação sexual (Sim/Não)

O fluxo permanece em **4 telas fixas** — a captura do biomarcador "Brilhante" não introduz uma 5ª tela, é um controle adicional dentro da Tela 2. Ver especificação de UI completa na Seção 9 do briefing de design (`CREIGHTON_DESIGN_SYSTEM_BRIEFING_CLAUDE_CODE.md`).

### 9.3. Telas-protótipo obrigatórias

**Dashboard do Homem:** círculo de status central, discreto o suficiente para não constranger se visto por terceiros (sem texto literal "FÉRTIL — RISCO DE GRAVIDEZ" na tela). Card com dia do ciclo atual, fase de contagem (P+1/P+2/P+3 quando aplicável) e ação de "confirmação de ciência" (grava que o parceiro viu o status do dia — isso é um evento, vale um campo próprio, não reaproveitar `DAILY_ENTRY`).

**Gráfico Creighton clássico:** obrigatoriamente landscape. Cada dia = coluna vertical com: selo colorido no topo, código literal abaixo (`raw_code`), número do dia do ciclo, símbolo "I" nos dias com `intercourse = true`, marcador de Ápice destacado (P, P1, P2, P3...). Esta tela consome diretamente `DAILY_FERTILITY_STATE.peak_relation` e `DAILY_ENTRY.raw_code` — é o primeiro consumidor real do modelo de dados versionado da Seção 2, e por isso é um bom teste de integração de ponta a ponta antes de fechar a Sprint 1.

---

## 10. RESUMO PARA O CODER (Claude Code)

**Todas as decisões de negócio pendentes foram resolvidas em 10/07 (Seção 8). Nenhuma sprint mapeada neste documento está bloqueada por decisão de Edu.**

- **Stack confirmada:** React Native + Expo (app), Node.js + Express + PostgreSQL puro (backend), deploy em Railway. Sem Supabase — Auth (Lucia/Auth.js) e sync (polling nas Sprints 0–2, WebSocket próprio só na Sprint 3) são construídos, não vêm de bundle pronto.
- Comece pelo pacote `@creighton/rules-engine`, isolado, sem dependência de app ou banco. Ele é o produto. Tudo mais é entrega em torno dele.
- Nunca implemente uma branch de decisão que não esteja explicitamente coberta na Seção 3. Se um caso não estiver mapeado, o comportamento correto é retornar `FERTILE` e sinalizar o gap para revisão — não inferir.
- `DAILY_ENTRY` inclui `shiny_reflex: boolean` desde o schema inicial (Seção 2) — não adicionar depois via migration solta.
- Confirmação de Ápice: regra de **3 dias consecutivos**, travada, é critério de aceite da Sprint 0.
- `DAILY_ENTRY` é imutável após criado (exceto correção explícita de instrutora). `DAILY_FERTILITY_STATE` é versionado via `superseded_by`, nunca sobrescrito com UPDATE. Use Prisma (ou Drizzle) para migrations versionadas em Git — essas constraints (`UNIQUE`, FKs) são parte da especificação, não detalhe de implementação.
- Segurança do MVP é TLS + at-rest padrão do Railway. Não implemente criptografia própria de campo agora — isso é Horizonte 2/3, documentado na Seção 6.
- Contrato de dados do dashboard do parceiro (Sprint 3) inclui os 4 tokens de cor completos — não simplificar no backend.
- Não inicie Sprint 3 (dual-sync + WebSocket) antes de Sprint 2 (single-user, polling) estar validada com dado real sincronizando corretamente após períodos offline.
