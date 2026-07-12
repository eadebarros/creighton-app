# Creighton Tracker — SPEC 02: Exportação PDF Clínica
**Status:** Aprovado por Edu em 11/07 — prioridade 1 da fila atual (antes da Sprint 4b)
**Por quê agora:** o PDF é o instrumento da validação clínica externa (gate de lançamento). A instrutora revisa o trabalho do motor no formato que ela reconhece — o gráfico Creighton impresso. Sem isso, o gate não destrava.
**Referências:** documento principal (Seção 6, item PDF; Seção 9.2 do gráfico), briefing de telas Sprints 2–4 (tela 4.5).

---

## 1. ESCOPO

**Entra:**
- Geração server-side de PDF com o gráfico Creighton clássico + tabela de dados do período.
- Proteção por senha definida pela usuária no momento da exportação (nunca persistida).
- Seleção de período: ciclo atual / últimos 3 ciclos / intervalo customizado.
- Download/compartilhamento via share sheet nativo do app.

**Não entra (não construir):**
- Envio automático por email a partir do servidor (a usuária compartilha o arquivo por onde quiser — menos superfície de dado sensível transitando por sistema nosso).
- Marca d'água, assinatura digital, ou qualquer recurso "enterprise" de documento.
- Exportação em outros formatos (CSV, imagem) — só PDF nesta spec.
- Histórico de exportações no servidor — o PDF é gerado, entregue e descartado (ver Seção 4).

---

## 2. CONTEÚDO DO PDF

### Página 1..N — Gráfico Creighton (uma linha de gráfico por ciclo, paisagem)

Reproduzir a leitura do gráfico físico do método — este documento vai para as mãos de uma instrutora credenciada, a fidelidade ao formato clássico é requisito, não estética:

- Orientação **paisagem** (A4 landscape).
- Cada ciclo = uma faixa horizontal com colunas por dia: **selo colorido** (os 4 tokens clínicos — RED `#E02424`, GREEN `#16A34A`, WHITE com contorno fino `--line` + ícone baby, YELLOW `#EAB308`), **`raw_code`** abaixo do selo em fonte monoespaçada, **número do dia do ciclo**, símbolo **"I"** nos dias com intercurso, marcador de fase **P / P+1 / P+2 / P+3** acima do selo quando aplicável.
- Ciclos sem Ápice confirmado (relevante após a Sprint 4b): faixa recebe a anotação "Ápice não confirmado neste ciclo" — nunca deixar parecer dado faltando.
- Dias com observações múltiplas: o selo mostra o pico consolidado (como no app); um asterisco discreto indica "2+ observações neste dia", com nota de rodapé explicando.
- Cabeçalho de cada faixa: número do ciclo, data de início/fim, variante ativa (Regular/Lactação/Pré-menopausa) — a instrutora precisa saber sob qual protocolo aquele ciclo foi calculado.

### Última página — Resumo técnico

- Identificação: nome da usuária (se cadastrado), período exportado, data de geração.
- Versão do motor de regras (`rule_engine_version`) vigente no período — se houve mais de uma versão no período, listar todas com as datas de vigência. Isso importa para a validação clínica: a instrutora precisa saber que o cálculo que ela está auditando é reproduzível.
- Contagem de observações anuladas no período (sem detalhá-las — só o número, transparência de auditoria).
- Disclaimer clínico padrão (mesmo texto do onboarding).

**Fora do PDF:** dados de conta, `partner_id`, configurações de privacidade — nada de metadado de sistema no documento clínico.

---

## 3. ARQUITETURA DE GERAÇÃO

- **Server-side, no backend Express existente** (Railway). Justificativa: o servidor já é a fonte de verdade do `DAILY_FERTILITY_STATE` (documento principal, Seção 4.3) — o PDF deve refletir o estado confirmado pelo servidor, nunca o estado local possivelmente desatualizado do dispositivo.
- **Biblioteca recomendada: `pdfkit`** (ou `@react-pdf/renderer` se preferir declarativo). NÃO usar Puppeteer/Chromium headless — o peso de um Chromium no container Railway não se justifica para um layout determinístico de gráfico; desenhar o gráfico programaticamente também garante fidelidade pixel-consistente entre gerações.
- **Fluxo:** `POST /exports/pdf` com `{ period, password }` → servidor valida sessão → consulta ciclos/entradas/estados (só registros `superseded_by IS NULL`) → gera PDF em memória ou arquivo temporário → aplica criptografia de senha padrão do PDF (AES, suportado nativamente pelo pdfkit via `userPassword`) → responde com o binário → **remove qualquer arquivo temporário imediatamente**.
- **Endpoint síncrono é aceitável no MVP** (períodos de até ~6 ciclos geram em bem menos de o timeout padrão). Se a geração passar de ~10s em teste com dado realista, aí sim converter para job assíncrono + polling — não construir a versão assíncrona preventivamente.

## 4. SEGURANÇA (regras duras)

1. A senha do PDF **nunca é persistida** — não vai para banco, não vai para log (atenção a middleware de logging de request body: mascarar o campo `password` explicitamente).
2. O PDF gerado **não fica armazenado** no servidor — gerado, entregue na resposta, descartado. Sem bucket, sem cache, sem "histórico de exportações".
3. Endpoint autenticado, e **só a PRIMARY_OBSERVER exporta** — o parceiro (COOP_PARTNER) não tem acesso a este endpoint, independentemente da configuração de privacidade. Exportar dado bruto é prerrogativa de quem o produz.
4. Rate limit no endpoint (ex: 10 exportações/hora por conta) — proteção barata contra abuso.

## 5. UI (tela 4.5 do briefing de design — já especificada, resumo do comportamento)

- Seleção de período → campo de senha (com confirmação, e nota visível: "esta senha não fica salva — guarde-a") → botão "Gerar PDF".
- Estados: configurando / gerando (loading com mensagem, não spinner mudo) / pronto (share sheet nativo) / erro específico ("período sem dados suficientes" quando aplicável, não erro genérico).
- Validação de senha no cliente: mínimo 6 caracteres. Não impor complexidade alta — a senha vai ser ditada por telefone para uma instrutora, pragmatismo aqui.

## 6. ORDEM DE EXECUÇÃO

1. Renderizador do gráfico em PDF isolado (função que recebe fixtures de ciclo e devolve o buffer) + validação visual manual contra um gráfico Creighton de referência.
2. Endpoint + autenticação + regras de segurança da Seção 4.
3. Tela 4.5 no app + integração.
4. Teste ponta a ponta com o dado real de teste (ciclo Regular completo + ciclo Lactação com PIB).

## 7. CRITÉRIOS DE ACEITE

- [ ] PDF de um ciclo Regular completo é visualmente conferível contra o gráfico do app (mesmos selos, códigos, marcadores P+n).
- [ ] Ciclo Lactação exibe selos amarelos e a variante identificada no cabeçalho da faixa.
- [ ] PDF abre somente com a senha correta; sem senha ou com senha errada, não abre.
- [ ] Campo `password` não aparece em nenhum log do servidor (verificar middleware).
- [ ] Nenhum arquivo residual no filesystem do container após a geração.
- [ ] COOP_PARTNER recebe 403 no endpoint.
- [ ] Dia com observação anulada + reconsolidada exporta o pico correto e conta a anulação no resumo técnico.

## 8. NÃO FAZER

- Não usar Puppeteer/Chromium para renderizar.
- Não persistir PDF nem senha em lugar nenhum, nem "temporariamente por conveniência".
- Não incluir dados de conta/sistema no documento.
- Não construir versão assíncrona/job queue antes de medir necessidade real.
