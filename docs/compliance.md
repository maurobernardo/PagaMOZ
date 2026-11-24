# Conformidade — o que falta para produção

> Este protótipo **não** é conforme com nenhum regime regulatório. Lista do que tem de ser
> confirmado com o regulador, parceiros e assessoria jurídica.

- [ ] Enquadramento legal da actividade (agregador / prestador de serviços de pagamento) junto do Banco de Moçambique.
- [ ] Contratos com gateways e operadoras (carteiras móveis, adquirente de cartões) com liquidação directa e split.
- [ ] Contratos de adesão com cada instituição (mandato de cobrança, SLA, reconciliação).
- [ ] KYC/AML: níveis de verificação, limites, monitorização de transacções suspeitas.
- [ ] Protecção de dados pessoais: base legal, consentimento, minimização, retenção, direitos do titular.
- [ ] Cartões: não armazenar dados de cartão (só tokens do adquirente); avaliar PCI DSS.
- [ ] Auditoria de segurança independente antes do lançamento.

Detalhe do que falta, por área (regulação, parceiros, homologação, técnico): ver `docs/proximos-passos-producao.md`.
