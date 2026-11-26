/**
 * Termos de utilização: descrevem o que o serviço faz de facto.
 * RASCUNHO: rever com um jurista antes do lançamento (lei aplicável, licença, prazos legais).
 */
export const TERMS = {
  updated: "Rascunho para revisão jurídica · Novembro de 2026",
  sections: [
    { title: "O que é o PagaMOZ", body: "Uma plataforma para pagar serviços de instituições (energia, água, impostos, multas, documentos e outros) por carteira móvel, cartão ou referência bancária. O PagaMOZ não é um banco e não guarda o seu dinheiro: cada pagamento vai para a conta da instituição." },
    { title: "A sua conta", body: "Entra com o seu número de telefone e um código por SMS. É responsável por manter o telemóvel seguro. Pode usar o serviço sem conta; com conta, guardamos o histórico e os comprovativos. Pode apagar a conta a qualquer momento nas Definições." },
    { title: "Pagamentos", body: "Antes de pagar mostramos o valor, a comissão (se houver) e o total. O pagamento só é feito depois de o confirmar no seu telemóvel (PIN da carteira) ou no seu banco. O comprovativo tem um código e um QR que qualquer pessoa pode verificar." },
    { title: "Dados que a instituição recebe", body: "Os dados que escreve para um serviço (número de cliente, contador, matrícula, documentos) são enviados à instituição que presta esse serviço, para ela o processar." },
    { title: "Problemas e devoluções", body: "Se pagou e não recebeu o serviço, use «Tenho um problema» no pagamento. A instituição responde e a resposta aparece no próprio pagamento. As devoluções são decididas pela instituição." },
    { title: "Funções inteligentes", body: "O assistente, a leitura de faturas e as previsões só propõem: nada é pago sem a sua confirmação. As datas e valores previstos são estimativas a partir dos seus pagamentos." },
    { title: "Utilização correcta", body: "Não é permitido usar o PagaMOZ para fraude, para pagar em nome de outra pessoa sem autorização, nem tentar contornar a segurança do serviço." },
  ],
};

/** Política de privacidade: o que guardamos e porquê (descreve o sistema real). RASCUNHO para revisão jurídica. */
export const PRIVACY = [
  { title: "Não guardamos o seu dinheiro", body: "O pagamento vai directamente para a conta da instituição. O PagaMOZ só regista que o pagamento aconteceu." },
  { title: "Cartão", body: "O número completo e o CVV nunca saem do seu aparelho. Guardamos apenas a marca e os últimos 4 algarismos para o comprovativo." },
  { title: "O que registamos", body: "O seu número de telefone (para entrar), os pagamentos que faz e, se quiser, nome, apelido, email, foto, província e distrito. Os dados que escreve para cada serviço vão para a instituição que o presta." },
  { title: "Para que usamos", body: "Para fazer os pagamentos, emitir comprovativos, mostrar as suas contas e avisar antes de vencerem. Não vendemos dados nem usamos publicidade." },
  { title: "Apagar", body: "Pode apagar a sua conta nas Definições: os dados pessoais são apagados. Os registos de pagamento ficam no servidor, sem ligação a si, porque são a prova de que o pagamento aconteceu." },
];
