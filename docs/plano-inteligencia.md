# PagaMOZ inteligente: plano

Hoje o PagaMOZ faz bem uma coisa: pagar um serviço de cada vez, quando a pessoa se lembra.
O salto é deixar de ser um sítio onde se paga e passar a ser quem **trata das contas da casa e da empresa**:
sabe o que vence, lê papéis, avisa antes, escolhe o melhor caminho, protege de burlas e responde em linguagem normal.

A regra de ouro, em todas as funcionalidades: **a inteligência propõe, a pessoa confirma.** Nenhum dinheiro sai sem um toque explícito.

---

## 1. O que torna isto difícil de copiar

1. **Dados que só nós juntamos.** Cada pagamento liga pessoa, instituição, valor, data, método e resultado.
   Com tempo, isso vira calendário de vencimentos, padrão de consumo e mapa de falhas por provedor. Um concorrente novo começa sem nada.
2. **Integração com as instituições.** Já temos consulta em tempo real, entrega (código Credelec) e reconciliação.
   A inteligência assenta nestes canais; quem só tem um botão de pagar não consegue avisar "a sua fatura saiu hoje".
3. **Feito para Moçambique.** Português falado como se fala cá, pessoas com pouca prática digital, telemóveis modestos, rede instável, carteiras móveis primeiro.

---

## 2. Para o cidadão

### 2.1 Fotografe e pague
Tira uma foto da fatura da EDM, da água, de uma guia GARE, de uma multa ou de uma propina, e a app preenche tudo:
instituição, número de cliente, referência, valor e prazo. Também lê comprovativos antigos e talões de recarga.

- **Como:** leitura de texto (OCR) no telemóvel, e depois um modelo de linguagem com o catálogo como lista de opções válidas
  (só pode escolher serviços que existem e campos que o serviço pede). Depois, a consulta à instituição confirma o valor real.
- **Porque importa:** acaba com o "onde está o número de cliente?" e com os erros de digitação. É o maior atrito actual.

### 2.2 Assistente "Diga o que quer pagar"
Escreve ou fala: *"paga 500 de credelec para a casa da mãe"*, *"quanto devo de propinas?"*, *"o meu passaporte já está pronto?"*.

- **Como:** modelo de linguagem com ferramentas que chamam a nossa própria API (pesquisar, consultar, preparar pagamento, estado do pedido).
  O assistente **prepara**; o ecrã de confirmação continua a ser o de sempre.
- **Memória útil:** "casa da mãe" passa a ser um contador guardado com nome.
- **Voz:** português falado primeiro. Línguas nacionais (changana, macua, sena…) entram depois, com testes reais antes de prometer.

### 2.3 Contas da casa (carteira que se mantém sozinha)
A app percebe que paga a água todos os meses, a TV no dia 5 e as propinas por prestação, e monta um calendário:

- vencimentos dos próximos 30 dias, com o valor já consultado à instituição sempre que houver consulta;
- avisos antes do prazo ("a fatura da água saiu: 1 240 MT, vence sexta");
- **pagamento agendado com confirmação de um toque** (nunca automático sem a pessoa aceitar a regra e cada execução).

### 2.4 Energia que não acaba de surpresa (Credelec)
Com o histórico de recargas, estima quantos dias faltam até o crédito acabar e quanto costuma gastar por mês.
Sugere a recarga **antes** de ficar às escuras, com o valor habitual pré-preenchido.

- **Como:** modelo simples por contador (média móvel e sazonalidade); explica sempre a estimativa ("pelas suas últimas 4 recargas").

### 2.5 Escolher o melhor caminho para pagar
Para cada pagamento, a app recomenda o método com mais probabilidade de passar **agora**:
se o M-Pesa está com falhas na última hora, sugere e-Mola ou referência bancária; se a pessoa costuma usar cartão, começa por aí.

- **Como:** taxa de sucesso por provedor em tempo real (já temos os webhooks e as falhas), mais as preferências da pessoa.
- Também mostra a comissão de cada caminho, quando há diferença.

### 2.6 Escudo contra burlas
- **SMS e mensagens falsas:** a pessoa cola ou partilha a mensagem ("o seu M-Pesa vai ser bloqueado, envie…") e a app diz se tem sinais de burla e porquê.
- **Comprovativos falsos:** já detectamos PDF adulterado; passa a ler também fotografias de comprovativos e compara com o registo.
- **Pagamentos estranhos:** valor muito fora do habitual, número novo, várias tentativas seguidas. Pede uma confirmação extra (biometria) e explica.

### 2.7 Pagar por outra pessoa (família e diáspora)
- Pedir a alguém para pagar uma conta (já existe a ligação; passa a ter estado, lembrete e agradecimento).
- **Dividir** uma conta entre várias pessoas (renda, propina, festa), cada uma paga a sua parte, e a instituição recebe uma só vez.
- Familiar fora do país paga a luz da casa em Moçambique com cartão estrangeiro.

### 2.8 Documentos sem mistério
Para passaporte, DIRE e outros pedidos: lista personalizada do que levar, alerta de documento em falta **antes** de pagar,
estado do pedido com previsão de quando fica pronto (aprendida com os tempos reais de cada posto), e aviso quando há falta de informação.

### 2.9 As minhas finanças, simples
Gastos por categoria e por mês (já há gráficos), mais:
"este mês gastou mais em energia do que o habitual", "as recargas de saldo somam X por mês",
orçamento por categoria com aviso discreto. Sempre com números da própria pessoa, nunca médias inventadas.

### 2.10 Para quem tem pouca prática
- **Modo simples:** ícones grandes, poucos passos, leitura em voz alta de cada ecrã e do comprovativo.
- **Sem internet:** fila de pedidos que segue quando a rede voltar; consulta do estado por SMS; mais tarde, menu USSD com os 5 pagamentos mais comuns.

---

## 3. Para as instituições (portal)

1. **Reconciliação que se resolve sozinha.** Hoje mostramos discrepâncias; passa a propor o par certo
   (referência com erro de um carácter, valor com comissão descontada, pagamento duplicado) e a pessoa só aprova.
2. **Previsão de receita** por dia e por serviço, com intervalo de confiança, para planear tesouraria.
3. **Cobrança inteligente.** Quem costuma pagar atrasado, quando costuma pagar, que lembrete funciona melhor.
   Campanhas de aviso a partir do portal, com resultados medidos.
4. **Alertas de anomalia.** Queda súbita de pagamentos (problema no provedor ou no conector), picos estranhos, possível fraude.
5. **Perguntas em linguagem normal ao painel:** *"quanto recebemos de multas em Maio, por distrito?"*.
   O modelo gera a consulta só sobre os dados dessa instituição (o isolamento entre instituições continua na base de dados, não no modelo).

---

## 4. Para a plataforma (backoffice)

- **Saúde dos provedores em tempo real** e encaminhamento automático para o canal que está a funcionar.
- **Detecção de fraude** com regras explicáveis primeiro, e um modelo depois, quando houver dados suficientes.
- **Qualidade do catálogo:** perguntas que ficaram sem resultado na pesquisa viram sugestões de novos serviços ou sinónimos.

---

## 5. Como se constrói (sem estragar o que existe)

| Peça | O que é | Nota |
|---|---|---|
| Registo de eventos | Cada pesquisa, consulta, pagamento e falha num registo único | Base de tudo; começa já, mesmo antes dos modelos |
| Serviço de inteligência | Um módulo na API (`intel/`) com endpoints próprios | A web e a app usam o mesmo |
| Modelo de linguagem | Claude, com ferramentas que chamam a nossa API | Nunca vê dados de cartão; mascarar telefone e nomes quando não fizerem falta |
| OCR | No telemóvel quando possível; no servidor como alternativa | A foto da fatura não fica guardada sem consentimento |
| Modelos simples | Previsão de Credelec, vencimentos, sucesso por provedor | Estatística explicável antes de modelos complexos |
| Tarefas agendadas | Celery (já existe) para lembretes, previsões, agendamentos | Notificações push já ligadas |

**Regras que não se negociam:**
- a inteligência nunca move dinheiro sozinha; cada pagamento tem confirmação explícita;
- explica sempre de onde vem uma sugestão;
- dados pessoais ficam no país e com consentimento, de acordo com a lei de protecção de dados aplicável (a confirmar com jurista);
- tudo o que é estimativa aparece como estimativa.

---

## 6. Ordem proposta

**Fase 1: impacto imediato (4 a 6 semanas)**
1. Registo de eventos.
2. Fotografe e pague (EDM, água, multas, GARE).
3. Contas da casa: calendário de vencimentos e lembretes.
4. Previsão Credelec.
5. Método recomendado por sucesso em tempo real.

**Fase 2: o assistente (6 a 8 semanas)**
6. Assistente por texto com ferramentas (pagar, consultar, estado).
7. Escudo contra burlas (mensagens e comprovativos em foto).
8. Reconciliação sugerida no portal.

**Fase 3: alcance e escala**
9. Voz em português; depois línguas nacionais, com testes.
10. Dividir contas e pagamentos da diáspora.
11. Previsão de receita e cobrança inteligente para instituições.
12. Modo sem internet, SMS e USSD.

**Como saber se está a funcionar** (medir desde o primeiro dia):
tempo até pagar, pagamentos falhados, lembretes que viram pagamento, contas pagas antes do prazo,
discrepâncias resolvidas sem intervenção, burlas sinalizadas.

## Estado (26/11/2026)

- Fase 1: feita (método recomendado, contas da casa, previsão Credelec, fotografe e pague com Tesseract).
- Fase 2: feita sem custos (assistente por regras, escudo contra burlas, reconciliação sugerida).
- Fase 3: previsão de receita e pagadores atrasados, USSD com simulador, voz do browser e do telemóvel, catálogo sem internet, dividir contas de valor livre. Falta: contrato USSD/SMS com operadora ou agregador, voz em línguas nacionais.
