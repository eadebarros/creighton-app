# Handoff: Creighton Tracker — Perfil & Configurações

## Sobre este pacote
Handoff isolado, cobrindo **apenas** as 7 telas de Perfil & Configurações. Não repete os tokens do design system (cores, tipografia, `<StampBadge>`) — isso já está no handoff principal (`README.md` nesta mesma pasta) e continua valendo sem alteração.

## Arquivo de referência
`design_files/Creighton Perfil e Configuracoes.dc.html` — protótipo navegável só desta área. Auto-contido: abre direto no navegador. Um seletor de telas + chips de estado no topo (fora do frame do celular) são só ferramenta de navegação do protótipo, não fazem parte do app. Depende de `ios-frame.jsx` (bezel, também só apresentação) e `support.js`, incluídos na mesma pasta.

## Contexto do redesign
As ações de conta que hoje vivem soltas no header do gráfico ("Convidar parceiro", "Exportar para instrutora", "Resetar dados locais", "Sair") saem de lá. O header do gráfico fica só com "Novo registro" + um ponto de acesso ao perfil. Tudo isso passa a morar nesta área nova.

## Fidelidade
Alta-fidelidade para layout, hierarquia e conteúdo das 7 telas — cores, tipografia e componentes seguem os tokens já fixados no design system (nenhum token novo, exceto `--danger`, ver abaixo). Copy é rascunho funcional — revisão final de texto é do Edu antes de produção.

## Token novo desta área
- `--danger`: `#B3423A` — ações destrutivas (desvincular parceiro, excluir conta). Deliberadamente distinto e mais apagado que o vermelho clínico `#E02424` do `<StampBadge>` — no app, vermelho já significa sangramento, então o vermelho de perigo precisa ser outro vermelho. **Nunca usar `#E02424` para ações destrutivas de UI, e nunca usar `--danger` dentro do `<StampBadge>` ou do círculo do Dashboard do Homem.**

## Telas

### 1. Configurações (hub)
Tela única, hub — não é navegação profunda. De cima pra baixo: bloco de identidade (avatar/inicial + nome + email em `--ink-muted` + linha de contexto do método, ex. "Modo atual: Regular · desde 12/05" — essa linha é o que diferencia este perfil de um genérico, é a primeira informação depois do nome), seção MÉTODO (Modo de acompanhamento com valor atual à direita, Exportar para instrutora), seção CASAL (Parceiro — valor dinâmico conforme estado do vínculo, Privacidade do parceiro), seção CONTA (Alterar senha, Notificações), seção DADOS & PRIVACIDADE (Baixar meus dados, Termos e disclaimer clínico), ZONA DE ATENÇÃO separada por espaço + hairline (só "Excluir minha conta" em `--danger`, sem fundo vermelho nem ícone de alerta), "Sair" isolado e neutro (não é destrutivo), rodapé com versão do app + motor de regras, pequeno e centralizado.
Padrão de lista: label à esquerda, valor/estado à direita em `--ink-muted`, hairlines entre itens — não cards individuais. Títulos de seção em caps pequenas, `--ink-muted`, tracking aberto.
Estado único (a variação relevante é o item Parceiro, ver Tela 2).

### 2. Parceiro (4 estados)
Ciclo de vida completo do vínculo.
- **Sem parceiro**: explicação curta do que ele verá + link "Configurar privacidade antes" + botão "Gerar convite" (reaproveita o fluxo já prototipado no handoff de Sprint 3).
- **Convite pendente**: código em destaque (fonte utilitária, tamanho grande), validade restante, ações "Compartilhar" (primária) e "Cancelar convite" (secundária neutra — cancelar não é destrutivo).
- **Vinculado**: nome do parceiro + data do vínculo, atalho para Privacidade do parceiro, e "Desvincular parceiro" em `--danger` na base, separado visualmente do resto.
- **Confirmar desvínculo** (sub-estado, acessado a partir de "Desvincular parceiro"): explica a consequência ("ele perde o acesso imediatamente, seus registros não são afetados"), checkbox de ciência que habilita o botão de confirmação (mesmo padrão da Tela 6, Passo 3 — usar o mesmo mecanismo de fricção deliberada nas duas telas).

### 3. Alterar senha
Senha atual → nova senha (mesmo indicador de força do cadastro, Sprint 2) → confirmar. Botão único "Alterar senha".
Estados: preenchendo / erro (senha atual incorreta — mensagem específica, não genérica) / sucesso (feedback inline, retorno automático ao hub).

### 4. Notificações
Dois toggles, nada mais.
- "Lembrete de registro diário" — time picker simples aparece só quando o toggle está ativo (não é agendador completo).
- "Avisar quando meu parceiro confirmar que viu" — **só existe se houver parceiro vinculado**. Sem parceiro, a tela tem um toggle só.
Estados: com/sem parceiro vinculado; lembrete ativo/inativo.

### 5. Baixar meus dados
Portabilidade (LGPD), tom neutro e informativo — **não é** a tela de exportação para instrutora (aquela pede senha e gera PDF; esta não pede senha e gera JSON). Diferenciar por título, ausência do campo de senha, e não deixar as duas visualmente idênticas.
Conteúdo: uma linha explicando o conteúdo do arquivo ("todos os seus registros, incluindo histórico completo, em formato aberto JSON") + botão "Gerar arquivo".
Estados: inicial / gerando (loading) / pronto (share) / erro.

### 6. Excluir minha conta (3 passos + encerramento)
Atrito deliberado e honesto — dificultar o impulso, não esconder o direito.
- **Passo 1 — Consequências**: lista curta e direta (exclusão definitiva do servidor, parceiro desvinculado na hora, sem recuperação — incluir janela de carência se houver). Card "Baixar meus dados antes" (atalho para Tela 5). Botão "Continuar" em `--danger` e "Cancelar" com **o mesmo peso visual** — não miniaturizar o cancelar, isso é dark pattern invertido e não é o tom do produto.
- **Passo 2 — Senha**: confirmação de identidade.
- **Passo 3 — Confirmação final**: digitar "EXCLUIR" para habilitar o botão final em `--danger` (mesmo mecanismo de fricção da Tela 2, sub-estado de desvínculo — escolher um padrão único entre os dois: checkbox OU frase digitada, não os dois modelos ao mesmo tempo no produto final).
- **Encerramento**: tela neutra "Sua conta foi excluída" — sem tentativa de retenção, sem "sentiremos sua falta".

### 7. Termos e disclaimer clínico
Só leitura. Registro discreto no topo de quando foi aceito ("Aceito em 12/05/2026 às 09:14"). Tipografia de leitura confortável (corpo maior que o padrão de UI). Sem ações além de voltar.

## Fora deste escopo (não desenhado, não implementar via design)
- Ferramentas de dev (reset local) — só em builds de dev, resolvido pelo Coder com o padrão da própria tela.
- Upload de foto de avatar, temas, idiomas — fora de escopo por decisão registrada.

## Não fazer
- Não usar `#E02424` (vermelho clínico) em nenhum botão ou texto destrutivo desta área — usar sempre `--danger` (`#B3423A`).
- Não fazer o botão "Cancelar" do Passo 1 (Tela 6) visualmente menor ou mais discreto que "Continuar".
- Não implementar dois mecanismos de fricção diferentes (checkbox vs. digitar palavra) para as duas confirmações destrutivas (desvínculo e exclusão de conta) — escolher um e aplicar aos dois antes de produção; o protótipo mostra ambos os padrões lado a lado só para decisão, não como especificação final de dois padrões distintos.
