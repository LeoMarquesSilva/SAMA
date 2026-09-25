# SAMA — Sistema de Análise de Metas e Atividades

**Documento para orçamento de desenvolvimento**  
Uso interno do Escritório · confidencial

---

## 1. Quem somos e o que precisamos

Somos um escritório de advocacia. Precisamos de um sistema web — o **SAMA** — para a equipe interna acompanhar **reuniões**, **atividades do dia a dia** e **o que ficou combinado** com clientes e internamente.

Hoje a agenda de cada pessoa vive no **Outlook / Microsoft 365**. O que falta é um lugar único em que o compromisso deixe de ser só um evento no calendário e vire um **registro do escritório**: que tipo de reunião foi, com qual cliente, o que se decidiu e quais são os próximos passos.

Pedimos a vocês uma proposta de **desenvolvimento completo** desse sistema (concepção da tela, construção, publicação, treinamento e um período de ajuste após o lançamento).

Este documento descreve **o que o sistema precisa fazer**, em linguagem de negócio. Não é um projeto técnico.

---

## 2. O problema que queremos resolver

- Cada profissional tem a própria agenda no Outlook. O escritório **não enxerga** de forma organizada o que foi reunião com cliente, o que foi trabalho interno e o que é irrelevante (médico, bloqueio pessoal etc.).
- Depois da reunião, o combinado se perde em e-mail, caderno ou memória.
- Sócios e administração precisam de **números** (quantas captações, quantas fidelizações, quanto tempo em gestão) sem cobrar planilha à parte.
- Já usamos outros sistemas do escritório (cadastro de clientes e controle de tarefas processuais). O SAMA deve **conversar** com eles, não substituí-los.

**Regra de ouro que o sistema deve respeitar:** quem manda na agenda é o Outlook. O SAMA **copia** o que está lá. Título, data, horário, local e convidados se alteram no Outlook. No SAMA a pessoa **classifica** o compromisso e registra o conteúdo gerencial.

---

## 3. Objetivo do projeto

Entregar um sistema em que:

1. Os compromissos do Outlook apareçam automaticamente no SAMA.
2. Cada pessoa classifique o que é **reunião**, o que é **atividade interna** e o que deve ser **ignorado**.
3. Nas reuniões já ocorridas, dê para registrar **resumo** e **próximos passos**.
4. Haja um **painel** com o resumo do período (por tipo de reunião, pessoa e cliente).
5. Administradores gerenciem **usuários**, consultem **clientes** e vejam **relatórios**.
6. Tarefas vindas do sistema processual do escritório possam ser **importadas e classificadas**, quando fizer sentido.

**Não faz parte deste orçamento** criar ou enviar agendamentos para o sistema de prazos e publicações do escritório. Esse tema, se existir, será uma fase posterior.

---

## 4. Quem vai usar

Uso interno, com e-mail corporativo. Ordem de grandeza: **dezenas de pessoas**, podendo crescer para pouco mais de uma centena. Uso **todos os dias úteis**, no computador e no celular.

| Perfil | O que essa pessoa faz no SAMA |
|--------|-------------------------------|
| **Colaborador** | Entra, vê **a própria** agenda, classifica compromissos, preenche resumo e próximos passos, acompanha o próprio painel. |
| **Sócio de área** | O mesmo, e enxerga agendas e números da **sua área**. |
| **Sócio** | Visão mais ampla das agendas e dos números do escritório. |
| **Administrador** | Tudo acima, mais cadastro de usuários, clientes, tarefas processuais, horas e relatórios. |

Áreas do escritório (exemplos a manter configuráveis): Cível, Trabalhista, Tributário, Reestruturação e Insolvência, Societário e Contratos, Operações Legais, Distressed Deals, T.I., Geral, Sócio.

---

## 5. O que o sistema precisa fazer

### 5.1 Entrar e se sentir seguro

- Acesso pelo **navegador** (Chrome, Edge, Safari), com visual profissional e em **português**.
- Login com **e-mail corporativo e senha**.
- No primeiro acesso, obrigar a **troca da senha provisória**.
- Recuperação de senha (ou fluxo em que o administrador redefine).
- Só quem estiver **ativo** no cadastro entra.
- Ao entrar, se houver compromissos sem classificar ou ações atrasadas, mostrar um **aviso claro** do que precisa de atenção.
- Primeiros usos: um **guia curto na tela** (calendário, painel e próximos passos), que a pessoa possa concluir e não ver de novo.
- Manual de ajuda dentro do próprio sistema (passos, dúvidas frequentes e glossário).
- Funcionar bem no **celular**, com atalhos para Início, Calendário e Próximos passos, e possibilidade de “adicionar à tela inicial” como se fosse um aplicativo.

### 5.2 Usuários (só administrador)

Cadastro da equipe interna, separado do cadastro de clientes.

Para cada pessoa: nome, e-mail, cargo, área, foto, se é administrador, se está ativa.

O administrador precisa:

- Criar, editar e desativar usuários.
- Gerar o primeiro acesso (senha provisória).
- Ver se a pessoa já entrou e **quando foi o último acesso**.
- Ativar em lote quem ainda está pendente.

Sem usuário cadastrado, o compromisso do Outlook dessa pessoa **não entra** no SAMA.

### 5.3 Calendário — o coração do sistema

Tela principal do dia a dia.

**Trazer a agenda do Outlook**

- Buscar automaticamente os compromissos de cada usuário cadastrado (janela típica: cerca de **30 dias para trás** e **90 para frente**).
- Botão **Atualizar** para puxar na hora (alguém criou, mudou ou cancelou no Outlook).
- O que sumiu ou foi cancelado no Outlook deve **sumir também** do SAMA.
- Cada participante do mesmo convite vê **o próprio item** e classifica o seu. Um colega não classifica pelo outro.

**Como a pessoa vê**

- Visão de **mês** (grade) e visão de **lista**.
- Filtros por situação e por tipo.
- Cores simples:
  - amarelo — ainda não classificado;
  - verde — reunião;
  - azul — atividade interna;
  - cinza — ignorado.
- Número no menu avisando quantos itens ainda faltam classificar.
- Ao clicar: título, data, horário, duração, se é online ou presencial, participantes, organizador e um trecho do convite, quando houver.

**Quem vê qual agenda**

- Colaborador: só a própria.
- Sócio de área: a própria e a da área.
- Sócio e administrador: podem ver as agendas das pessoas (com filtro por colega).

### 5.4 Classificar o compromisso

Todo item amarelo pede uma decisão: **Reunião**, **Atividade** ou **Ignorar**.

**Ignorar**  
Compromisso pessoal ou que não deve entrar nas métricas. Dá para desfazer e voltar a “não classificado”.

**Reunião**  
O formulário já nasce com o que veio do Outlook. Título e horário **não se editam** no SAMA.

A pessoa preenche:

- **Tipo** (com texto explicando cada um):
  - Captação
  - Fidelização
  - Relacionamento institucional
  - Gestão estratégica
  - Gestão de equipe
  - Gestão operacional
  - Eventos e palestras
- **Cliente** — busca no cadastro (obrigatório na maior parte dos tipos). Reuniões internas de equipe/operação podem associar automaticamente o grupo interno do escritório.
- **Participantes** — vêm do convite; dá para ajustar.
- **Modalidade:** presencial no escritório, presencial externo ou online.
- **Situação:** agendada, realizada, cancelada ou reagendada. Compromisso já passado chega como realizada, e a pessoa pode corrigir.

Quando a reunião está **realizada**, aparecem:

- **Resumo** — o que se discutiu e decidiu.
- **Próximos passos** — lista de ações, com caixinha para marcar como feito, e possibilidade de indicar responsável e prazo.

Reunião ainda **agendada** (futura) **não** pede resumo nem próximos passos. Depois que acontecer, a pessoa muda para realizada e preenche.

Dá para editar o que já foi classificado e **desfazer** a classificação (isso não mexe no Outlook).

**Atividade interna**  
Trabalho que ocupou a agenda, mas não é reunião com cliente, por exemplo: parecer, despacho, revisão, elaboração de prazo, audiência, sustentação oral, palestra/evento, levantamento de due / proposta / contrato.

### 5.5 Próximos passos

Tela só com as ações das reuniões **já realizadas**, agrupadas por reunião.

- Contagem de pendentes e concluídas.
- Busca por reunião, cliente ou texto da ação.
- Filtro: pendentes, feitas ou todas.
- Marcar a caixinha **salva sozinho**.
- Clique no título da reunião para reabrir o registro e editar o resumo.
- Número no menu com as pendências da pessoa.

### 5.6 Painel (dashboard)

Resumo do período — só fica útil depois que as pessoas classificam o calendário.

- Períodos: um dia, este mês, 3 meses, 6 meses, este ano.
- Cartões por **tipo de reunião**.
- Lista das próximas / recentes, com data, cliente e participantes.
- Filtro por tipo.
- Colaborador vê **só os próprios** números. Sócio e administrador podem filtrar por pessoa.
- Clicar num cartão ou numa reunião abre o calendário já filtrado.
- Atalho se ainda houver itens sem classificar.

### 5.7 Clientes (só administrador)

O escritório **já tem** cadastro de clientes em outro sistema. O SAMA não é o cadastro-mestre: deve **espelhar e consultar** esses dados (nome, grupo econômico, empresas do grupo, identificadores internos).

O administrador precisa:

- Buscar por nome, documento ou grupo.
- Ver o grupo (quantas empresas, volume).
- Abrir o detalhe e ver o **histórico de reuniões** daquele cliente no SAMA (realizadas, agendadas, participantes, tipo).

Na hora de classificar uma reunião, qualquer usuário autorizado busca o cliente nesse cadastro.

### 5.8 Tarefas do sistema processual (só administrador)

O escritório já controla **tarefas e prazos processuais** em outro sistema (chamado internamente de VIOS).

O SAMA deve:

- Trazer essas tarefas (atualização automática e/ou botão de atualizar; também aceitar carga por planilha, se a conexão falhar).
- Mostrar prazo, cliente, quem concluiu, situação.
- Permitir **classificar** a tarefa como reunião ou atividade do SAMA (já puxando o que der de texto), **ignorar**, ou desfazer.
- Isso é **acompanhamento e classificação**. Não é criar prazo nem mandar publicação nesse outro sistema.

### 5.9 Relatórios (visão gerencial)

- Lista de reuniões no período, com tipo, situação, modalidade, cliente, duração e participantes.
- Filtro por período e tipo.
- Totais (realizadas, canceladas, tempo).
- Quem não é administrador vê só o que participou.
- Administrador exporta (planilha e/ou PDF).

### 5.10 Horas

Visão simples de tempo dedicado, por pessoa e por categoria, com recortes (este mês, mês passado, ano, tudo). Nesta fase, uso principalmente da administração. Pode nascer enxuto, desde que o tempo das reuniões e atividades classificadas possa alimentar essa visão.

### 5.11 Ajuda

Manual dentro do sistema, com busca, perguntas frequentes e glossário dos termos da casa (classificar, ignorar, não categorizado, etc.).

---

## 6. Integrações que o fornecedor deve prever

Não pedimos que vocês inventem a agenda nem o cadastro de clientes. Pedimos que liguem o SAMA ao que já usamos.

| Integração | Para que serve | Observação para o orçamento |
|------------|----------------|-----------------------------|
| **Microsoft 365 / Outlook** | Ler calendários da equipe, trazer e atualizar compromissos | Essencial. O escritório já usa contas corporativas Microsoft. |
| **Cadastro de clientes do escritório** | Buscar cliente na reunião e tela de clientes | Já existe; o SAMA consulta / espelha. |
| **Sistema de tarefas processuais (VIOS)** | Trazer tarefas para classificar | Já existe; o SAMA não cria prazo nem publicação. |
| **Fotos / dados da equipe** (se houver base interna) | Foto e lista de participantes | Desejável; se não houver, o admin cadastra na mão. |

A proposta deve deixar claro **o que vocês precisam que o escritório forneça** (acessos Microsoft, contato de quem cuida dos outros sistemas, ambiente de teste).

E-mail, senha e permissões do SAMA são **do SAMA**. Não é o mesmo que “entrar na Microsoft”. A ligação com o Outlook é feita **pelo sistema**, com autorização do escritório, sem cada pessoa precisar colar senha do Outlook no SAMA.

---

## 7. Experiência que esperamos

- Linguagem clara, botões com nomes óbvios, pouco texto técnico.
- A pessoa classifica um compromisso **em poucos cliques**, sem retrabalho do que já está no Outlook.
- Confirmação antes de apagar ou desativar algo importante.
- Avisos de sucesso e de erro em português, compreensíveis.
- Mesmo visual no computador e no celular (no celular, o essencial na mão: classificar e marcar passo).
- Desempenho aceitável no dia a dia (abrir o mês, atualizar o Outlook, buscar cliente).

---

## 8. Fora deste orçamento

Para não inflar a proposta, **não incluam**:

- Criar reunião no Outlook a partir do SAMA (convite, sala, Teams). Continua nascendo no Outlook.
- Enviar ou gravar agendamento no sistema de prazos/publicações (VIOS).
- Aplicativo nas lojas (App Store / Google Play). O uso no celular é pelo navegador.
- Portal para o **cliente final** do escritório.
- Financeiro, faturamento, ponto eletrônico ou RH.
- Substituição do Outlook, do Teams ou do sistema processual.

---

## 9. O que pedimos na proposta

Por favor, enviem:

1. **Valor** (fechado ou por etapa) e o que está incluso.
2. **Prazo** até um primeiro uso real com um grupo piloto e até o uso do escritório inteiro.
3. Preço **separado por bloco**, para podermos cortar ou fatiar:
   - acesso, usuários e permissões;
   - calendário + Outlook;
   - reuniões, atividades e próximos passos;
   - painel;
   - clientes;
   - tarefas processuais;
   - relatórios e horas;
   - ajuda, celular e publicação.
4. Quantas rodadas de ajuste de tela estão inclusas.
5. Hospedagem: vocês operam ou entregam para o escritório operar? Custo mensal, se houver.
6. Treinamento (administradores e usuários de área) e material simples.
7. Garantia / suporte nos primeiros 60–90 dias após o lançamento.
8. Premissas (o que o escritório precisa entregar: acessos Microsoft, lista de usuários, contato dos outros sistemas).
9. O que **não** está no preço.

Não precisamos de detalhe de linguagem de programação. Precisamos entender **escopo, prazo, risco das integrações e preço**.

---

## 10. Premissas do escritório

- Haverá um responsável interno para dúvidas de regra de negócio e para testar as telas.
- Conseguiremos autorizar a leitura dos calendários Microsoft da equipe.
- Conseguiremos combinar o acesso (somente leitura / cópia) ao cadastro de clientes e às tarefas processuais.
- O lançamento pode ser **por etapas**: primeiro calendário + classificação + próximos passos + painel; depois clientes, tarefas, relatórios e horas.
- Dados são **internos e sigilosos**. Acesso só com login. Cada um vê o que o perfil permite. Backup e ambiente seguro fazem parte da entrega.

---

## 11. Como saber se ficou pronto

O escritório considera a primeira versão utilizável quando:

- Um usuário entra, vê os compromissos do próprio Outlook e classifica reunião / atividade / ignorar.
- Depois de uma reunião realizada, registra resumo e próximos passos, e marca a ação como feita na tela própria.
- O painel reflete o que ele classificou no período.
- Um administrador cadastra alguém novo e, na atualização seguinte, a agenda dessa pessoa passa a entrar.
- Um administrador encontra um cliente e vê as reuniões ligadas a ele.
- Sócio ou administrador consegue olhar a agenda de outra pessoa, conforme as regras da seção 5.3.
- No celular dá para classificar e marcar um próximo passo sem “quebrar” a tela.

---

## 12. Contato para o orçamento

**Sistema:** SAMA — Sistema de Análise de Metas e Atividades  
**Documento:** briefing para proposta comercial  
**Escopo:** conforme seções 1 a 11, **sem** a fase de agendamento no sistema de prazos/publicações

Aguardamos proposta com valor, prazo e premissas.
