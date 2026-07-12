# Creighton Tracker — ADENDO 02: Confirmação de Ápice Cross-Ciclo (Sprint 4b — Pré-menopausa)
**Status:** Arquitetura aprovada por Edu em 11/07 (Opção B). Executar APÓS a SPEC 02 (PDF) estar entregue.
**Problema que resolve:** em pré-menopausa, a confirmação do Ápice do ciclo N depende de a menstruação real cair na janela de 8–16 dias após P+4 — mas essa menstruação, pela nossa própria regra, **abre o ciclo N+1**. O evento confirmador mora no ciclo seguinte, e o motor atual é estritamente por-ciclo.
**Decisão de arquitetura:** o motor continua por-ciclo (contrato e testes existentes intactos). Ganha uma função pura nova, pequena e isolada, executada pelo orquestrador no evento de fechamento de ciclo. Mesmo padrão do Adendo 01: evento novo → reconsolidação → pipeline existente.

---

## 1. DELTA DE SCHEMA

### 1.1. `CYCLE` ganha resolução explícita de Ápice

```
CYCLE (campos novos):
│ peak_resolution: Enum (PENDING / CONFIRMED / UNCONFIRMED_CLOSED)
│     DEFAULT PENDING
│ peak_candidate_date: Date (nullable)
│     ← último candidato ativo ao fechar (para auditoria do não-confirmado)
```

Semântica:
- `PENDING`: ciclo aberto, ou fechado mas ainda não processado pelo confirmador.
- `CONFIRMED`: Ápice confirmado — em variante Regular/Lactação pelo fluxo normal (3 dias não-pico); em Pré-menopausa, pela janela cross-ciclo (Seção 2).
- `UNCONFIRMED_CLOSED`: ciclo fechou sem Ápice confirmável. **Estado clinicamente válido em pré-menopausa**, não erro nem dado faltando. O gráfico e o PDF exibem "Ápice não confirmado neste ciclo" (o hook disso já está previsto na SPEC 02, Seção 2).

Migration: backfill dos ciclos existentes — `confirmed_peak_day IS NOT NULL` → `CONFIRMED`; ciclos fechados sem peak em variante Regular/Lactação → `UNCONFIRMED_CLOSED`; ciclo ativo → `PENDING`.

### 1.2. O que NÃO muda

- `confirmed_peak_day` e `peak_day_confirmed_at` continuam como estão.
- Nenhuma tabela nova. Nenhum campo em `DAILY_ENTRY`, `OBSERVATION` ou `DAILY_FERTILITY_STATE`.

---

## 2. RULES-ENGINE: `confirmPeakOnCycleClose` (função nova, pura, isolada)

### 2.1. Assinatura e contrato

```typescript
confirmPeakOnCycleClose(input: {
  closingCycle: {
    variantMode: VariantMode;
    peakTracker: PeakTrackerState;   // NONE | CANDIDATE(date) | CONFIRMED(date)
    entries: DailyEntry[];            // já consolidadas (pós Adendo 01)
  };
  nextCycleStartDate: Date;           // data do sangramento H/M que abriu o N+1
}): PeakClosureResult

type PeakClosureResult =
  | { resolution: 'CONFIRMED'; peakDay: Date }
  | { resolution: 'UNCONFIRMED_CLOSED'; lastCandidate: Date | null }
```

Função pura, sem I/O, testável com fixtures — mesmo padrão de todo o pacote.

### 2.2. Regras (fechadas)

```
SE variantMode != MENOPAUSE:
  → passthrough: se peakTracker == CONFIRMED(Tc), retorna CONFIRMED(Tc);
    senão retorna UNCONFIRMED_CLOSED(lastCandidate).
    (Regular e Lactação não usam a janela cross-ciclo — a confirmação
     deles já aconteceu, ou não, pelo fluxo intra-ciclo normal.)

SE variantMode == MENOPAUSE:
  1. Se peakTracker == CONFIRMED(Tc) pelo fluxo intra-ciclo
     (caso raro mas possível: candidato + 3 dias não-pico + menstruação
      dentro da janela, tudo antes do fechamento):
     → validar janela mesmo assim (passo 2). A confirmação intra-ciclo
       em MENOPAUSE é PROVISÓRIA até a validação da janela.
  2. Janela: dias entre (Tc + 4) e nextCycleStartDate, exclusive-inclusive.
     Se 8 <= (nextCycleStartDate - (Tc + 4)) <= 16 dias:
        → CONFIRMED(Tc)
     Senão:
        → UNCONFIRMED_CLOSED(Tc)
  3. Se havia múltiplos candidatos na timeline do ciclo (permitido em
     MENOPAUSE, ver documento principal Seção 3.5): avaliar do MAIS
     RECENTE para o mais antigo; o primeiro que satisfizer a janela é
     o Ápice confirmado. Nenhum satisfazendo → UNCONFIRMED_CLOSED com
     lastCandidate = o mais recente.
```

**Ambiguidade → conservador, como sempre:** qualquer situação não coberta acima (datas inconsistentes, candidato sem entries correspondentes) → `UNCONFIRMED_CLOSED`. Um ciclo sem Ápice confirmado nunca gera estado `INFERTILE_ABSOLUTE` retroativo — errar aqui é errar para FÉRTIL.

### 2.3. Efeito no pipeline (orquestrador — código de aplicação, fora do rules-engine)

Gatilho: criação de ciclo N+1 por sangramento H/M (evento que já existe).

```
1. Rodar confirmPeakOnCycleClose sobre o ciclo N.
2. Gravar peak_resolution (+ confirmed_peak_day se CONFIRMED) no CYCLE N.
3. SE CONFIRMED: disparar o recálculo retroativo existente (Seção 3.3 do
   documento principal) sobre o ciclo N — gera P/P+1/P+2/P+3 e
   INFERTILE_ABSOLUTE de P+4 em diante, com versionamento superseded_by
   normal. Nota: em MENOPAUSE isso reescreve dias que estavam FERTILE
   por default — é exatamente o comportamento desejado, e o histórico
   do que foi mostrado ao casal em cada dia fica preservado.
4. SE UNCONFIRMED_CLOSED: NENHUM recálculo de estado — os dias do ciclo
   N permanecem com o estado que tinham (FERTILE por default na espera).
   Só o CYCLE ganha a resolução, para o gráfico/PDF anotarem.
```

**Consequência de UX que já está decidida e o Coder não deve "melhorar":** em pré-menopausa, o casal pode passar o ciclo inteiro em FERTILE e só ao fechar o ciclo descobrir que aquele candidato era (ou não) o Ápice. O label "Ciclo longo sob monitoramento" (já definido) cobre a espera. Não inventar estado intermediário tipo "provavelmente infértil" — não existe isso no método.

### 2.4. Caso de borda: edição retroativa após fechamento

Se uma observação do ciclo N for anulada/adicionada (Adendo 01) **depois** de o ciclo já ter `peak_resolution` definido: reconsolidar o dia, re-rodar `confirmPeakOnCycleClose` e atualizar a resolução se ela mudar (com recálculo/reversão de estados via `superseded_by`). Uma correção de dado pode legitimamente transformar CONFIRMED em UNCONFIRMED_CLOSED e vice-versa — o pipeline precisa ser idempotente nesse caminho.

---

## 3. UI (mínima — as telas da 4b já estão no briefing de design)

1. Tela "Ciclo longo sob monitoramento" (4.4 do briefing de telas): sem mudança.
2. Ao fechar ciclo com `CONFIRMED`: notificação/estado no dashboard — "Ápice do ciclo anterior confirmado retroativamente" com link para o gráfico. Discreto, informativo.
3. Ao fechar com `UNCONFIRMED_CLOSED`: mensagem neutra — "O ciclo anterior encerrou sem Ápice confirmado. Isso é comum neste modo." Nunca tom de falha.
4. Gráfico: faixa do ciclo com anotação "Ápice não confirmado" quando aplicável (mesmo tratamento do PDF, SPEC 02).

## 4. ORDEM DE EXECUÇÃO

1. `confirmPeakOnCycleClose` no rules-engine + fixtures (critérios a–f abaixo). Nada de banco antes.
2. Migration dos campos de `CYCLE` + backfill.
3. Orquestrador: gatilho no fechamento de ciclo + recálculo condicional + caminho de reprocessamento (2.4).
4. UI (Seção 3) + anotação no gráfico.
5. Suíte completa + regressão de Regular/Lactação (garantir que o passthrough não alterou nada).

## 5. CRITÉRIOS DE ACEITE

- [ ] a. MENOPAUSE, candidato único, menstruação em Tc+4+10 dias → CONFIRMED, recálculo gera P..P+3 FERTILE e P+4+ INFERTILE_ABSOLUTE versionados.
- [ ] b. MENOPAUSE, menstruação em Tc+4+5 dias (antes da janela) → UNCONFIRMED_CLOSED, zero recálculo de estados.
- [ ] c. MENOPAUSE, menstruação em Tc+4+20 dias (depois da janela) → UNCONFIRMED_CLOSED.
- [ ] d. MENOPAUSE, dois candidatos, só o mais antigo satisfaz a janela → esse é o CONFIRMED (avaliação do mais recente ao mais antigo, primeiro que satisfaz vence).
- [ ] e. Regular/Lactação → passthrough puro: resultado idêntico ao estado do tracker, nenhum estado recalculado por esta função. Regressão completa das suítes existentes passa sem alteração.
- [ ] f. Anulação de observação após CONFIRMED que invalida o candidato → resolução vira UNCONFIRMED_CLOSED e os estados P+4+ INFERTILE_ABSOLUTE são revertidos via superseded_by (nunca deletados).
- [ ] g. Fronteiras da janela: exatamente 8 e exatamente 16 dias → ambos CONFIRMED (inclusive nas duas pontas).
- [ ] h. Ciclo UNCONFIRMED_CLOSED aparece anotado no gráfico do app e no PDF.

## 6. NÃO FAZER

- Não mudar a assinatura das funções existentes do motor para receber múltiplos ciclos — a fronteira por-ciclo permanece; só esta função nova enxerga a data de início do ciclo seguinte, e nada além dela.
- Não criar estado de fertilidade intermediário ("provável", "quase confirmado") — os estados são os três existentes, ponto.
- Não confirmar Ápice em MENOPAUSE sem a validação da janela, mesmo que o fluxo intra-ciclo de 3 dias tenha batido.
- Não deletar estados ao reverter uma confirmação — sempre superseded_by.
