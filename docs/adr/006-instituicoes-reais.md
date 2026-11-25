# ADR-006 — Catálogo com instituições reais

**Estado:** aceite · **Data:** 2026-11-25 · Substitui o ponto "nomes fictícios" do `CLAUDE.md` §3.

## Decisão
A pedido do promotor, o catálogo usa os **nomes** reais das instituições a quem a demo vai ser apresentada
(EDM, AdRMM, AT, INATTER, INSS, CMM, SENAMI, UEM, operadoras, TV, EMOSE, HCM), com os **dados que cada uma pede**
e o **formato das respostas** que devolve (código Credelec, faturas em aberto, autos de multa, prestações).

## Limites (mantêm-se)
- Sem logótipos, cores ou identidade visual das instituições — só o nome, em texto.
- As respostas (titulares, faturas, valores em dívida, códigos) são **geradas pelo conector simulado**. Nenhuma API
  real é chamada; cada integração real exige documentação oficial e acordo com a instituição.
- Valores oficiais só com fonte: passaporte e DIRE CPLP (Diploma Ministerial n.º 18/2024). O resto vem da consulta.
- O pagamento continua simulado (sem dinheiro real). A marcação mantém-se no rodapé e na marca de água dos
  comprovativos; o selector de cenários só aparece em modo apresentador (`?apresentador=1`).

Fontes e pontos por verificar: `docs/pesquisa-instituicoes.md`.
