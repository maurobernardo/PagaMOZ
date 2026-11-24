# ADR-005 — Portal da instituição: MFA e reconciliação

**Estado:** aceite · **Data:** 2026-11-24

## MFA
- Login do portal em dois passos: telefone + palavra-passe, depois TOTP (RFC 6238, implementado com stdlib,
  compatível com qualquer app autenticadora). Primeiro acesso força a configuração.
- Só a sessão que passou o TOTP tem `mfa_ok`; a permissão `InstitutionRole` recusa o portal sem ele
  (`PORTAL_REQUIRE_MFA`). Uma sessão de cidadão (OTP SMS) nunca dá acesso ao portal.
- Bloqueio de 15 min após 5 palavras-passe erradas; código TOTP não reutilizável (`mfa_last_counter`).
- Em `DEMO_MODE` o ecrã mostra o código actual para a apresentação correr sem telemóvel.
- Pendente (Fase 8): cifrar `mfa_secret` em repouso; códigos de recuperação.

## Reconciliação
- Diária às 23:30 (Maputo): importa o extracto do provedor (`StatementLine`) e compara por `(método, provider_ref)`
  com as transacções confirmadas nesse dia.
- Divergências: `falta_no_provedor`, `falta_na_plataforma`, `valor_divergente`, `estado_divergente`.
  Cada instituição vê só as suas; resolução exige nota e fica na auditoria.
- No simulador o extracto é gerado a partir da própria plataforma; `manage.py demo_reconciliation --injectar`
  provoca uma divergência de cada tipo para a demonstração.
- Em produção, `SimulatedStatementSource` é substituído pelo ficheiro/API de cada parceiro.
