# Creighton Tracker — ADENDO 01: Múltiplas Observações Diárias & Pico do Dia
**Status:** Correção de mecânica central — executar ANTES de considerar Sprint 4a (Lactação) fechada
**Referência:** complementa `CREIGHTON_TRACKER_ESTADO_ATUAL_V2.md` (resolve a pendência da linha ~148: múltiplas observações por dia)
**Decisão de Edu:** confirmada em 11/07 — o método exige múltiplas observações diárias; o gráfico registra o "pico do dia".

---

## 0. O PROBLEMA (contexto para o Coder)

O Método Creighton prescreve observação a cada ida ao banheiro — várias por dia. O gráfico registra **uma entrada por dia: a observação de pico (mais fértil) entre todas as checagens**, não a última nem a média.

O código atual trata re-gravação no mesmo dia como substituição (last-write-wins). Consequência: se a leitura mais fértil vier de manhã e uma menos fértil for gravada à noite, a informação clinicamente decisiva do dia se perde. Isso afeta todas as variantes, e afeta diretamente o modo Lactação recém-construído: o PIB é estabelecido por 3 dias consecutivos de `raw_code` idêntico — se o `raw_code` diário vem de "última gravação vence", o PIB pode se estabelecer sobre dado errado.

### Solução decidida (e a que NÃO usar)
- **NÃO implementar** "substituir só se a nova leitura for igual ou mais fértil". Isso: (a) impede correção de erro de digitação; (b) coloca conhecimento clínico (ordenação de fertilidade) na camada de escrita, fora do rules-engine; (c) descarta observações — incoerente com a arquitetura de auditoria (`superseded_by`).
- **Implementar:** observações intradiárias como eventos brutos append-only; "pico do dia" como **estado derivado, calculado pelo rules-engine** — mesmo padrão já usado para o Ápice.

---

## 1. DELTA DE SCHEMA

### 1.1. Nova tabela `OBSERVATION`

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OBSERVATION  (evento bruto, append-only)          │
├─────────────────────────────────────────────────────────────────────┤
│ id: UUID (PK)                                                        │
│ cycle_id: UUID (FK -> CYCLE)                                         │
│ date: Date            ← dia clínico da observação                    │
│ observed_at: Timestamp ← momento real do registro                    │
│ bleeding_type: Enum (H, M, L, VL, B, NONE)                           │
│ mucus_sensation: Enum (DRY, DAMP, WET, LUBRICATIVE)                  │
│ mucus_stretch: Enum (NONE, STICKY, TACKY, ELASTIC)                   │
│ mucus_color: Enum (CLEAR, CLOUDY, CLOUDY_CLEAR, YELLOW, BROWN, RED)  │
│ shiny_reflex: Boolean                                                │
│ raw_code: String       ← código desta observação individual          │
│ intercourse: Boolean                                                 │
│ entry_source: Enum (USER / INSTRUCTOR_CORRECTION)                    │
│ voided: Boolean DEFAULT false  ← correção de erro: anula, não apaga  │
│ voided_at: Timestamp (nullable)                                      │
│ INDEX(cycle_id, date)                                                │
│ SEM constraint UNIQUE(cycle_id, date) — múltiplas por dia é o normal │
└─────────────────────────────────────────────────────────────────────┘
```

**Correção de erro de digitação:** a usuária pode anular uma observação (`voided = true`), nunca deletar nem editar in-place. Uma observação anulada é ignorada pelo `pickDailyPeak`, mas permanece no banco (auditoria). Editar = anular a antiga + criar nova. Isso mantém o princípio append-only sem impedir correção.

### 1.2. `DAILY_ENTRY` passa a ser derivado (consolidação do dia)

`DAILY_ENTRY` deixa de ser o que a usuária digitou e passa a ser **o resultado do `pickDailyPeak` sobre as observações não-anuladas do dia**:
- Mantém o mesmo schema e a `UNIQUE(cycle_id, date)` — continua sendo "uma linha por dia" (o gráfico e o restante do motor não mudam de contrato).
- Ganha os campos: `peak_observation_id: UUID (FK -> OBSERVATION)` e `consolidated_at: Timestamp`.
- É **reescrito (upsert) a cada nova observação ou anulação do dia** — este é o único lugar do sistema onde upsert in-place é permitido, porque `DAILY_ENTRY` agora é derivado (o dado bruto imutável mora em `OBSERVATION`; a auditoria de estado mora em `DAILY_FERTILITY_STATE.superseded_by`, que continua funcionando exatamente como antes).
- Escritas diretas de UI em `DAILY_ENTRY` são **removidas** — só o consolidador escreve nela.

### 1.3. Migration + backfill

1. Criar tabela `OBSERVATION`.
2. Backfill: para cada `DAILY_ENTRY` existente, criar 1 `OBSERVATION` equivalente (`observed_at = entered_at`, `voided = false`) e setar `peak_observation_id` apontando para ela.
3. A partir daí, o fluxo de escrita passa por `OBSERVATION` → consolidador → `DAILY_ENTRY`.
4. Migration reversível documentada (down migration), como as demais.

---

## 2. RULES-ENGINE: `pickDailyPeak` (nova função no pacote `@creighton/rules-engine`)

### 2.1. Assinatura e contrato

```typescript
pickDailyPeak(observations: Observation[]): DailyConsolidation
// Recebe TODAS as observações não-anuladas de um mesmo (cycle_id, date).
// Função pura. Lança erro se o array estiver vazio ou tiver datas mistas.

type DailyConsolidation = {
  peakObservationId: string;      // a observação vencedora (para mucus_*/shiny/raw_code)
  bleedingType: BleedingType;     // o MAIS INTENSO do dia (ver 2.3)
  intercourse: boolean;           // OR lógico de todas as observações do dia
}
```

### 2.2. Ordenação de fertilidade (fechada — não inferir além dela)

Tier de fertilidade do `raw_code`, do menos ao mais fértil:

```
0  <  2  <  2W  <  4  <  6[cor]  <  8[cor]  <  10[cor]  ≈  10DL
```

Regras de desempate, nesta ordem:
1. **Tier maior vence** (tabela acima). `10[cor]` e `10DL` são o mesmo tier máximo.
2. **Dentro do mesmo tier, observação "tipo-pico" vence** (color = CLEAR, ou sensation = LUBRICATIVE, ou stretch = ELASTIC) — porque é ela que alimenta o tracker de Ápice.
3. **Persistindo empate, a mais recente (`observed_at`) vence** — desempate arbitrário mas determinístico; clinicamente indiferente porque as observações são equivalentes.

Qualquer combinação fora da tabela → tratar como tier máximo (princípio FÉRTIL-por-default do projeto se aplica aqui também).

### 2.3. Consolidação dos campos não-muco

- `bleedingType`: prevalece o mais intenso do dia, na ordem `H > M > L > VL > B > NONE`. Independe de qual observação venceu no muco — sangramento e muco consolidam separadamente (uma manhã com fluxo M + uma noite com muco 10C resultam em `bleeding = M` E muco da observação da noite; a precedência visual RED do selo já está definida na Seção 9.1 do documento principal e não muda).
- `intercourse`: `true` se qualquer observação do dia tiver `true`.
- `shiny_reflex`, `mucus_*`, `raw_code`: vêm integralmente da observação vencedora (`peakObservationId`) — não misturar campos de observações diferentes no muco.

### 2.4. Encadeamento com o motor existente

Após consolidar `DAILY_ENTRY`, o pipeline existente roda inalterado: recálculo do estado do dia + eventuais recálculos retroativos (Ápice, PIB), gerando novos `DAILY_FERTILITY_STATE` versionados via `superseded_by` como sempre. **Nenhuma regra do motor atual muda** — só a origem do `DAILY_ENTRY`.

Atenção especial (é o motivo do timing desta correção): reconsolidar um dia pode mudar o `raw_code` diário e, portanto, **quebrar ou estabelecer um PIB em Lactação retroativamente**. O pipeline de recálculo já lida com mudança retroativa de estado; garantir via teste que ele é disparado também quando a mudança vem de reconsolidação, não só de entrada nova.

---

## 3. AJUSTES DE UI (mínimos nesta correção)

1. **"Registrar novamente hoje":** o fluxo de captura existente passa a criar uma nova `OBSERVATION` em vez de sobrescrever. Sem redesign — mesmo fluxo de 4 telas.
2. **Dashboard principal:** quando houver 2+ observações no dia, indicar discretamente ("2ª observação de hoje registrada") e exibir o selo do **pico consolidado**, não da última gravação.
3. **Anular observação:** lista simples das observações do dia (horário + raw_code) com ação "anular" e confirmação. Sem tela nova elaborada — pode viver num bottom sheet acessado pelo card do dia. Mockup refinado fica para o Claude Design depois; aqui basta funcional.

---

## 4. ORDEM DE EXECUÇÃO (um passo por vez, confirmar antes de avançar)

1. `pickDailyPeak` no rules-engine + testes (Seção 5, itens a–e). **Nada de banco/UI antes disso passar.**
2. Migration: tabela `OBSERVATION` + backfill + campos novos em `DAILY_ENTRY`.
3. Consolidador (serviço que reage a insert/void em `OBSERVATION` e faz upsert em `DAILY_ENTRY` + dispara pipeline de recálculo).
4. Redirecionar escrita da UI para `OBSERVATION`; remover escrita direta em `DAILY_ENTRY`.
5. Ajustes de UI (Seção 3).
6. Rodar a suíte completa do rules-engine + testes de Lactação existentes — **critério de fechamento do Sprint 4a**, que só é considerado concluído com este adendo integrado.

## 5. CRITÉRIOS DE ACEITE

- [ ] a. Manhã `0` (seco) + noite `10C` → pico do dia = `10C`. Ordem invertida (fértil de manhã, seco à noite) → pico continua `10C`.
- [ ] b. Empate de tier com uma observação tipo-pico → tipo-pico vence.
- [ ] c. Observação anulada é ignorada pelo `pickDailyPeak`; anular a vencedora reconsolida o dia e dispara recálculo (inclusive retroativo se afetar Ápice/PIB).
- [ ] d. `bleeding` consolida pelo mais intenso independentemente do vencedor de muco; `intercourse` consolida por OR.
- [ ] e. Combinação não mapeada → tier máximo (FERTILE-por-default).
- [ ] f. Cenário Lactação: PIB estabelecido sob last-write-wins com dado que o novo consolidador altera → após migração/reconsolidação, PIB é corretamente quebrado/reestabelecido com `superseded_by` apontando o histórico.
- [ ] g. Backfill: todo `DAILY_ENTRY` pré-existente tem exatamente 1 `OBSERVATION` correspondente e `peak_observation_id` preenchido.
- [ ] h. Nenhum caminho de código da UI escreve diretamente em `DAILY_ENTRY`.

## 6. NÃO FAZER

- Não implementar precedência de fertilidade na camada de escrita/handler — ordenação clínica vive só em `pickDailyPeak`.
- Não deletar nem editar `OBSERVATION` in-place — só `voided`.
- Não alterar nenhuma regra existente do motor (Ápice, dia alternado, PIB) — este adendo muda a origem do `DAILY_ENTRY`, não as regras que o consomem.
- Não criar UI de "escolha manual do pico do dia" — o pico é sempre calculado, nunca escolhido pela usuária.
