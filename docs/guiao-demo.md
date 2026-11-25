# Guião da demonstração (6 minutos)

**Para quem:** director financeiro ou de sistemas de uma instituição que cobra ao público (água, energia, município, universidade, autoridade tributária) e de bancos parceiros.

**Como chegam:** conhecem bem as filas no balcão e o trabalho de conferir extractos ao fim do dia. Desconfiam de plataformas de pagamento porque imaginam um intermediário que fica com o dinheiro dias a fio e devolve um ficheiro que ninguém consegue conferir.

**A crença a mudar:** "aderir a uma plataforma é perder controlo sobre o nosso dinheiro".

**A única acção no fim:** marcar uma reunião técnica para um piloto com um serviço.

---

## Antes de entrar na sala

```powershell
.\tasks.ps1 demo
```

```powershell
.\tasks.ps1 up
```

Deixe três separadores abertos no portátil e um telemóvel ao lado:

1. `http://localhost:3000/?apresentador=1` em modo telemóvel (F12, vista de dispositivo). O parâmetro liga, só nesse browser, o selector de cenário do simulador.
2. `http://localhost:3000/portal`, já com login feito na **EDM**: telefone `840000001`, palavra-passe do `.env` e o código que aparece no ecrã
3. `http://localhost:3000/backoffice` (opcional, para perguntas de bancos)

Teste o projector. A faixa amarela "AMBIENTE DE DEMONSTRAÇÃO" tem de se ver: é ela que diz à sala que nada aqui é dinheiro real.

---

## 0:00 · Gancho (20 s)

> "Quanto tempo a vossa equipa gastou ontem a perceber se o dinheiro que entrou bate com o que foi pago? Vou mostrar um pagamento de ponta a ponta. No fim, quero que me digam em que conta caiu o dinheiro."

Não se apresente ainda. Abra logo o telemóvel.

## 0:20 · O cidadão paga (90 s)

No separador 1, pesquise **"Credelec"** e abra *Recarga de energia Credelec*.

1. Contador `12345678901`, valor `500` e depois **Verificar e continuar**.
   > "Antes de pagar, a plataforma confirma com a EDM de quem é o contador. Ninguém carrega energia no contador errado."
   Aponte para o titular mascarado: os dados pessoais não aparecem inteiros.
2. **Continuar para pagamento**, escolha M-Pesa, número `84 123 4567` e cenário `sucesso`.
3. **Pagar**. Aparece **Pagamento confirmado** e, logo abaixo, o **código de recarga Credelec**.
   > "Três ecrãs. O código chega no próprio telemóvel, pronto a introduzir no contador."

   Para mostrar uma fatura com várias linhas, repita com *Fatura de água* (AdRMM), cliente `1234567`: aparecem as faturas em aberto, com período e vencimento.

## 1:50 · O comprovativo prova-se a si próprio (60 s)

Carregue em **Descarregar comprovativo (PDF)**. Mostre o QR e a marca de água.

Leia o QR com o telemóvel (ou clique no código de verificação) e aparece **Comprovativo autêntico**.

> "Um fiscal, um balcão ou o próprio cidadão confirmam isto em segundos. E se alguém mexer num único carácter do PDF..."

Em `/verificar`, carregue um PDF alterado. A página diz que o ficheiro não corresponde a nenhum comprovativo emitido.

> "...o sistema percebe."

## 2:50 · A virada: onde está o dinheiro (90 s)

Mude para o separador 2 (portal da instituição). Deixe o cartão verde no ecrã alguns segundos antes de falar.

> "Isto é o que a instituição vê. Liquidado **na vossa conta**: banco e últimos dígitos. Logo abaixo, o que está confirmado e a caminho da mesma conta. A plataforma não guarda o vosso dinheiro. O parceiro de pagamento transfere directamente para vocês. A plataforma organiza, confirma e prova."

Abra **Liquidações**: um lote por dia, com bruto, comissão e valor creditado.

> "A comissão está à vista, linha a linha. Nada é descontado às escondidas."

## 4:20 · Reconciliação: o fim do dia que já vem feito (60 s)

Abra **Reconciliação**, dia de ontem.

> "Todas as noites cruzamos o extracto do provedor com cada pagamento. Ontem houve uma diferença: o provedor reportou um valor diferente do confirmado. Está aqui, com a referência, à espera de quem a resolva."

Carregue em **Marcar resolvida** e escreva uma nota curta.

> "Fica registado quem resolveu e porquê. Esse registo não se apaga, nem por um administrador."

## 5:20 · Pedido de documentos (opcional, 30 s)

Se a sala for de um registo, município ou universidade, abra **Pedidos**: o formulário, o anexo e os botões *Em análise* e *Aprovado*.

> "Serviços que precisam de análise humana também entram: o cidadão paga e acompanha o estado, e a vossa equipa trata o pedido aqui."

## 5:50 · Fecho (10 s)

> "O próximo passo é pequeno: escolhemos **um** serviço vosso, ligamos ao vosso sistema em ambiente de testes e medimos durante um mês. Podemos marcar a reunião técnica esta semana?"

Pare aqui. Não resuma.

---

## Perguntas que costumam aparecer

**"Quem guarda o dinheiro?"**
Ninguém além de vocês e do parceiro licenciado. A plataforma nunca tem a custódia dos fundos (ver `docs/adr/001-modelo-de-dinheiro.md`).

**"E se a nossa API estiver em baixo?"**
O pagamento do cidadão fica confirmado na mesma. A notificação à instituição é repetida automaticamente e, se ainda assim falhar, aparece no backoffice para ser reenviada.

**"Os pagamentos são reais?"**
Não. Tudo o que está nesta demo é simulado e as instituições são fictícias. A integração real com cada carteira móvel e cada instituição só é escrita a partir da documentação oficial de cada uma.

**"Quanto custa?"**
A comissão é configurável por instituição e por serviço, e define-se também quem a paga (o cidadão ou a instituição). O valor concreto fica para a proposta comercial do piloto.

**"Que dados pessoais ficam convosco?"**
Só os necessários para o serviço. O comprovativo e a página de verificação não mostram telefone, NUIT nem nome.

## Se algo correr mal ao vivo

- **Pagamento "pendente" que não avança:** confirme que escolheu o cenário `sucesso`. O `timeout` é de propósito e fica pendente.
- **Portal volta ao login:** a sessão expirou. Entre de novo; o código MFA aparece no ecrã.
- **Página lenta na primeira abertura:** com `npm run dev` cada página compila no primeiro acesso. Para a apresentação use `npm run build` seguido de `npm run start`.
