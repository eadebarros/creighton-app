# Creighton Tracker — SPEC 03: Perfil & Configurações
**Status:** Aprovado para execução — 12/07
**Contexto:** o app não tem área de perfil/configurações. Ações de conta e de sistema estão hoje espalhadas no header da tela de gráfico ("Convidar parceiro", "Exportar para instrutora", "Resetar dados locais", "Sair") — incluindo uma ação destrutiva a um toque de distância do uso diário. Esta spec cria a casa definitiva dessas funções e adiciona o que falta por obrigação legal (LGPD).

---

## 1. PRINCÍPIOS DESTA ÁREA

1. **Tirar o perigo do caminho.** Nenhuma ação destrutiva ou irreversível fica a menos de 2 interações deliberadas de distância (entrar em Configurações → seção específica → confirmação explícita). O header da tela de gráfico fica só com "Novo registro" + ícone de perfil.
2. **Uma tela, seções agrupadas — não um labirinto.** É um app de uso diário de 10 segundos; configurações são visitadas raramente. Uma tela principal com seções e poucas subtelas (só onde a ação exige fluxo próprio). Não criar navegação profunda estilo app enterprise.
3. **Reaproveitar o que já existe.** Várias funções desta área já foram especificadas em briefings anteriores (privacidade 3.4, troca de variante 4.1, exportação 4.5, convite 3.1). Esta spec **organiza e referencia**, não reespecifica — o Coder deve linkar as telas existentes, não duplicá-las.

---

## 2. ESTRUTURA DA TELA PRINCIPAL DE CONFIGURAÇÕES

Acesso: ícone/avatar no header do dashboard e do gráfico (substitui os 4 links de texto atuais do header, que são removidos).

```
┌────────────────────────────────────────┐
│  ← Perfil & Configurações               │
│                                          │
│  [Avatar/inicial]  Nome da usuária       │
│  email@exemplo.com                       │
│  Modo atual: Regular · desde 12/05       │
│                                          │
│  ── MÉTODO ─────────────────────────    │
│  Modo de acompanhamento        Regular > │   → tela 4.1 (já especificada)
│  Exportar para instrutora            >   │   → tela 4.5 (já especificada)
│                                          │
│  ── CASAL ──────────────────────────    │
│  Parceiro                 [estado]   >   │   → ver Seção 3.1
│  Privacidade do parceiro             >   │   → tela 3.4 (já especificada)
│                                          │
│  ── CONTA ──────────────────────────    │
│  Alterar senha                       >   │   → ver Seção 3.2
│  Notificações                        >   │   → ver Seção 3.3
│                                          │
│  ── DADOS & PRIVACIDADE ────────────    │
│  Baixar meus dados                   >   │   → ver Seção 3.4 (LGPD)
│  Termos e disclaimer clínico         >   │   → ver Seção 3.5
│                                          │
│  ── ZONA DE ATENÇÃO ────────────────    │
│  Excluir minha conta                 >   │   → ver Seção 3.7 (LGPD)
│                                          │
│  Sair                                    │   → confirmação simples
│                                          │
│  versão 1.0.0 · motor de regras v1.3     │   → ver Seção 3.8
└────────────────────────────────────────┘
```

A "Zona de Atenção" é visualmente separada (espaçamento maior + texto das ações em tom mais sóbrio — **não vermelho clínico `#E02424`**, que é token reservado ao selo de sangramento; usar um vermelho distinto e mais apagado, ex. `#B3423A`, definido como token novo `--danger` no theme).

---

## 3. ESPECIFICAÇÃO POR ITEM

### 3.1. Parceiro (estado dinâmico)
O item muda conforme o vínculo:
- **Sem parceiro:** label "Convidar parceiro" → abre o fluxo da tela 3.1 (já especificado). O link atual do header do gráfico é removido; este passa a ser o único ponto de entrada.
- **Convite pendente:** label "Convite enviado · expira em Xh" → subtela com o código ativo, opção de reenviar/cancelar.
- **Vinculado:** label com nome do parceiro → subtela com: data do vínculo, acesso rápido à Privacidade (3.4), e ação **"Desvincular parceiro"** (confirmação em 2 passos: explicar o que acontece — o parceiro perde acesso imediato ao status; os dados dela não são afetados — e exigir confirmação por texto ou toque longo). Desvincular é novo: não existia em nenhuma spec anterior. Backend: anular `partner_id` dos dois lados + invalidar sessões de realtime/polling do parceiro para o dado dela.

### 3.2. Alterar senha
Fluxo padrão: senha atual → nova senha (com o mesmo indicador de força do cadastro) → confirmação. Invalidar as demais sessões ativas ao concluir (se houver suporte a múltiplas sessões). Sem recuperação por dentro do app — "esqueci minha senha" continua sendo o fluxo de email do login.

### 3.3. Notificações (ATUALIZADO 12/07 — lembrete diário promovido a funcionalidade central)
**Decisão de Edu:** o registro diário é o coração do método — sem observação registrada, não há cálculo confiável. O lembrete deixa de ser toggle acessório e passa a ser tratado como funcionalidade de adesão ao método.

**Arquitetura — notificação LOCAL, não push:**
- Usar `expo-notifications` com agendamento local recorrente. Zero backend: funciona offline (coerente com o offline-first do app), sem FCM/APNs próprios, sem dependência de infraestrutura nova.
- Push server-side NÃO entra nesta spec — fica reservado para eventos do parceiro ("confirmou que viu"), que exigem servidor por natureza e serão tratados quando aquela notificação for construída.

**Regra dura de privacidade (inegociável):**
- O conteúdo da notificação NUNCA inclui estado de fertilidade, cor de selo, fase do ciclo ou qualquer dado clínico. Ela aparece em tela bloqueada, visível a terceiros.
- Texto padrão: título "Creighton Tracker" (ou só o nome curto do app), corpo "Hora do seu registro de hoje". Nada além disso. Sem emoji de gota, bebê ou similar — o ícone do app já identifica; o corpo não pode identificar o *assunto* para quem olha por cima do ombro.

**Comportamento:**
1. **Lembrete principal:** um por dia, no horário escolhido pela usuária (default sugerido: 21h — fim do dia, quando o "pico do dia" já pode ser consolidado com todas as observações; a lógica do método favorece registro ao fim do dia, não de manhã).
2. **Supressão inteligente:** se o dia já tem registro (qualquer `OBSERVATION` não-anulada com `date` = hoje), a notificação do dia é cancelada. Implementação: ao gravar uma observação, cancelar a notificação agendada de hoje; ao abrir o app, reagendar a série se necessário.
3. **Lembrete de reforço (opcional, off por default):** segundo toggle "Insistir se eu esquecer" — dispara +2h após o principal, apenas se o dia continuar sem registro. Máximo de 2 notificações/dia, sem escalada além disso. Não construir streaks, gamificação ou culpabilização ("você perdeu 3 dias!") — adesão ao método se sustenta por utilidade clínica, não por pressão.
4. **Resiliência de agendamento:** reagendar a série de notificações a cada abertura do app (cobre reboot do dispositivo, mudança de timezone e limpezas de sistema — comportamento sabidamente frágil de notificações locais agendadas em Android). O horário escolhido é sempre interpretado no timezone atual do dispositivo.
5. **Permissão do SO:** pedir no fim do onboarding (após a seleção de variante, tela 2.4), com uma tela de contexto ANTES do prompt do sistema ("O método depende do registro diário — quer que a gente te lembre?"), para não queimar o prompt único do iOS num momento sem contexto. Se negado, o toggle em Configurações fica visível com estado "permissão negada" e atalho para os ajustes do sistema.

**UI em Configurações (ajuste sobre o que já estava):**
- Toggle "Lembrete de registro diário" + seletor de horário (visível só com toggle ativo).
- Toggle "Insistir se eu esquecer" (visível só com o principal ativo).
- Toggle "Avisar quando meu parceiro confirmar que viu" — permanece especificado, mas marcado como INATIVO/oculto até o push server-side existir. Não exibir toggle que não funciona.

### 3.4. Baixar meus dados (LGPD — portabilidade)
Obrigação legal para dado sensível de saúde, não feature opcional. Gera um export **JSON completo** (todas as `OBSERVATION` — inclusive anuladas —, `DAILY_ENTRY`, `DAILY_FERTILITY_STATE` com histórico de versões, `CYCLE`) entregue pelo share sheet. Server-side, mesmo padrão de segurança da SPEC 02: gerado, entregue, descartado; sem senha (é a titular pedindo o próprio dado; o JSON é para portabilidade, não para instrutora). Rate limit igual ao do PDF.

### 3.5. Termos e disclaimer clínico
Tela estática com o texto completo do disclaimer aceito no onboarding + data/hora do aceite registrado (`instructor_credential_ack`). Sem ação além de leitura.

### 3.6. Resetar dados locais (ferramenta de desenvolvimento — NÃO é feature de usuária)
**Decisão de Edu (12/07):** o reset local existe só para os testes dele, não para a usuária final. Implementação:
- **Gate por build, não por obscuridade:** a seção "Ferramentas de desenvolvimento" (contendo o reset) só é renderizada quando `__DEV__ === true` (dev builds do Expo). Em build de produção, o código do componente nem entra no bundle — não é item escondido, é item inexistente para a usuária. Não usar truques de "7 toques na versão" — isso é obscuridade, e um app de dado de saúde não deve ter ações destrutivas descobríveis por acidente.
- Localização em dev builds: seção própria "DEV" no final da tela de Configurações, visualmente distinta (fundo levemente diferente), acima do rodapé de versão.
- Comportamento da ação em dev: mesmo escopo de antes (limpa banco local + ressincroniza do servidor, nada apagado no servidor). Manter a **trava de outbox** ("há X registros não sincronizados") mesmo sendo ferramenta de dev — com opção de forçar ("Resetar mesmo assim"), já que em teste às vezes é exatamente o que se quer. A trava vira aviso com override, não bloqueio absoluto.
- O link "Resetar dados locais" do header atual do gráfico é removido em qualquer build.

### 3.7. Excluir minha conta (LGPD — direito de exclusão)
Novo, obrigatório. Fluxo em 3 passos deliberados:
1. Tela de consequências: exclusão definitiva de todos os registros no servidor, desvínculo automático do parceiro, sem recuperação. Oferecer "Baixar meus dados" (3.4) como passo sugerido antes.
2. Confirmação por senha.
3. Confirmação final por texto digitado ("EXCLUIR") ou equivalente.
Backend: hard delete das tabelas da usuária (é a exigência da LGPD — não soft delete disfarçado), desvinculação do parceiro (a conta dele permanece, sem acesso a nada dela), invalidação de todas as sessões. Janela de carência (ex: 7 dias com possibilidade de cancelar por email) é aceitável e recomendada — se adotada, comunicar claramente no passo 1.

### 3.8. Rodapé de versão
`versão do app · motor de regras vX.Y`. A versão do motor visível aqui não é vaidade técnica: é o mesmo `rule_engine_version` que sai no PDF da instrutora — dá à usuária e à instrutora um jeito de conferir por telefone se estão falando do mesmo cálculo.

---

## 4. FORA DE ESCOPO (não construir nesta spec)

- Edição de nome/avatar com upload de foto — campo nome editável simples é suficiente; foto fica para depois.
- Preferências de tema (claro/escuro segue o sistema).
- Idiomas.
- Central de ajuda/FAQ dentro do app.
- Gestão de múltiplos dispositivos/sessões visível à usuária.

## 5. ORDEM DE EXECUÇÃO

1. Tela principal + navegação + remoção dos links do header do gráfico (a tela nasce linkando o que já existe: 4.1, 4.5, 3.1, 3.4).
2. Itens novos de baixo risco: alterar senha (3.2), termos (3.5), rodapé (3.8).
3. Notificações (3.3): agendamento local + supressão inteligente + tela de contexto no onboarding + reagendamento resiliente. Ganhou peso próprio — testar em dispositivo físico Android e iOS, não só simulador (comportamento de notificação agendada diverge entre eles na vida real).
4. Reset local como ferramenta dev gated por `__DEV__`, com trava de outbox + override (3.6).
5. Desvincular parceiro (3.1, estado vinculado).
6. LGPD: baixar dados (3.4) e excluir conta (3.7) — por último porque envolvem backend novo e são os fluxos que mais exigem cuidado de teste.

## 6. CRITÉRIOS DE ACEITE

- [ ] Header do gráfico contém apenas "Novo registro" + acesso ao perfil; os 4 links de texto atuais foram removidos.
- [ ] Nenhuma ação da Zona de Atenção executa com menos de 2 interações deliberadas após entrar em Configurações.
- [ ] Seção DEV (incluindo reset local) não existe no bundle de produção — verificar no build de release, não só visualmente. Em dev build: reset com outbox não vazia exibe aviso com contagem e opção de forçar; com outbox vazia, reseta e ressincroniza corretamente do servidor.
- [ ] Desvincular parceiro corta o acesso do COOP_PARTNER imediatamente (polling e realtime) e preserva 100% dos dados da usuária.
- [ ] Export LGPD contém observações anuladas e histórico completo de `superseded_by` — não só o estado atual.
- [ ] Exclusão de conta remove os dados da usuária do servidor (verificável por query direta), desvincula o parceiro sem afetar a conta dele, e invalida sessões.
- [ ] Tokens clínicos (RED/GREEN/WHITE/YELLOW) não aparecem em nenhum elemento desta área; ações perigosas usam o token novo `--danger`.
- [ ] Versão do motor de regras exibida bate com o `rule_engine_version` gravado nos estados recentes.
- [ ] Notificação dispara no horário configurado quando o dia está sem registro; NÃO dispara quando já existe `OBSERVATION` não-anulada no dia (testar os dois cenários).
- [ ] Conteúdo da notificação (título + corpo) não contém nenhum dado clínico — verificável por inspeção do payload agendado, não só visual.
- [ ] Reforço (+2h) só dispara com o toggle ativo E o dia ainda sem registro; máximo absoluto de 2 notificações/dia.
- [ ] Após reboot do dispositivo (ou mudança de timezone), a série é reagendada na primeira abertura do app e o lembrete volta a funcionar.
- [ ] Permissão negada: toggle exibe o estado e leva aos ajustes do sistema; nenhum crash ou agendamento silencioso falho.

## 7. NÃO FAZER

- Não usar o vermelho clínico `#E02424` em botões/ações destrutivas — criar `--danger` separado.
- Não implementar soft delete disfarçado de exclusão de conta.
- Não duplicar as telas já especificadas (4.1, 4.5, 3.1, 3.4) — linkar.
- Não adicionar itens de configuração "porque é fácil" — o escopo é o da Seção 2, fechado.
- Não incluir estado de fertilidade, selo ou fase do ciclo em nenhuma notificação, sob nenhuma configuração.
- Não construir streaks, contadores de dias perdidos ou qualquer mecânica de culpabilização em torno do lembrete.
- Não implementar push server-side nesta spec — lembrete diário é 100% local.
- Não exibir o toggle de notificação do parceiro enquanto o push server-side não existir.
