/** Nomes em português para o registo de auditoria (o código técnico fica no título, ao passar o rato). */
export const ACTION_LABEL: Record<string, string> = {
  "account.delete": "Apagou a conta",
  "auth.google_login": "Entrou com Google",
  "auth.google_portal_step1": "Entrou com Google (falta o 2.º passo)",
  "auth.google_sem_conta": "Tentou entrar com Google sem conta",
  "auth.invite_resent": "Enviou novo convite",
  "auth.mfa_failed": "Código de verificação errado",
  "auth.otp_login": "Entrou com código SMS",
  "auth.password_set": "Definiu a senha",
  "auth.portal_login": "Entrou no portal",
  "auth.portal_login_failed": "Falhou a entrada no portal",
  "complaint.open": "Abriu uma reclamação",
  "complaint.respond": "Respondeu a uma reclamação",
  "institution.create": "Criou uma instituição",
  "institution.update": "Alterou uma instituição",
  "member.add": "Juntou alguém à equipa",
  "member.role": "Mudou o perfil de um membro",
  "member.remove": "Tirou alguém da equipa",
  "reconciliation.run": "Correu a reconciliação",
  "request.status": "Mudou o estado de um pedido",
  "service.create": "Criou um serviço",
  "service.update": "Alterou um serviço",
  "payment.criada": "Pagamento criado",
  "payment.pendente": "Pagamento à espera do provedor",
  "payment.confirmada": "Pagamento confirmado",
  "payment.liquidada": "Pagamento liquidado",
  "payment.falhada": "Pagamento falhou",
  "payment.expirada": "Pagamento expirou",
  "payment.revertida": "Pagamento revertido",
  "payment.em_disputa": "Pagamento em disputa",
  "deadletter.retry": "Repetiu um evento falhado",
  "deadletter.discard": "Descartou um evento falhado",
};

const KEY_LABEL: Record<string, string> = {
  de: "Antes", para: "Depois", reason: "Motivo", role: "Perfil", login: "Conta", phone: "Telefone", slug: "Identificador",
  status: "Estado", changes: "Alterações", amount: "Valor", method: "Método", reference: "Referência",
};

const VALUE_LABEL: Record<string, string> = {
  CRIADA: "criado", PENDENTE: "pendente", CONFIRMADA: "confirmado", LIQUIDADA: "liquidado", FALHADA: "falhou",
  EXPIRADA: "expirou", REVERTIDA: "revertido", EM_DISPUTA: "em disputa", admin: "Administrador", financeiro: "Financeiro", operador: "Operador",
  activa: "activa", suspensa: "suspensa", onboarding: "em adesão",
};

export const actionLabel = (a: string) => ACTION_LABEL[a] ?? a;

/** {"de":"PENDENTE","reason":"..."} -> "Antes: pendente · Motivo: ..." */
export function dataLabel(d: unknown): string {
  if (!d || typeof d !== "object") return "";
  return Object.entries(d as Record<string, unknown>)
    .filter(([, v]) => v !== "" && v != null)
    .map(([k, v]) => {
      const val = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${KEY_LABEL[k] ?? k}: ${VALUE_LABEL[val] ?? val}`;
    })
    .join(" · ");
}
