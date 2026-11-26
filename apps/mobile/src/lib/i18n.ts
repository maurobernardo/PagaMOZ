/**
 * Idioma da interface. A frase em português é a própria chave; o inglês traduz-a.
 * O que vem da API (nomes de serviços e instituições) fica como a instituição o escreve.
 */
export let lang: "pt" | "en" = "pt";
export const setLang = (l: "pt" | "en") => { lang = l; };

const EN: Record<string, string> = {
  // geral
  "Início": "Home", "Serviços": "Services", "Verificar": "Verify", "Conta": "Account", "Perfil": "Profile",
  "Definições": "Settings", "Voltar": "Back", "Guardar": "Save", "Cancelar": "Cancel", "Continuar": "Continue",
  "Sair": "Sign out", "Entrar": "Sign in", "Todos": "All", "Ver tudo": "See all", "Limpar": "Clear",
  "Bom dia": "Good morning", "Boa tarde": "Good afternoon", "Boa noite": "Good evening",
  // boas-vindas
  "Pague tudo\nsem ir ao balcão": "Pay everything\nwithout the queue",
  "Luz, água, recargas, impostos e documentos. O dinheiro vai direito para a instituição e recebe comprovativo na hora.":
    "Power, water, airtime, taxes and documents. Money goes straight to the institution and you get a receipt instantly.",
  "Deslize para começar": "Swipe to start", "Já tem conta?": "Have an account?", "Começar": "Start",
  // início
  "O que vamos pagar?": "What are we paying?", "Pesquisar serviço ou instituição": "Search a service or institution",
  "Pagar rápido": "Quick pay", "Os pagamentos mais comuns, a um toque.": "The most common payments, one tap away.",
  "Todos os assuntos": "All topics", "Último pagamento": "Last payment", "Pagamentos": "Payments", "Total pago": "Total paid",
  "Já pagou? Veja o estado.": "Already paid? Check the status.", "Escreva o código que recebeu (começa por PMZ).": "Type the code you received (starts with PMZ).",
  "O código começa por PMZ e tem 13 caracteres.": "The code starts with PMZ and has 13 characters.",
  "serviço": "service", "serviços": "services",
  // serviços
  "Toque num assunto ou pesquise pelo nome.": "Tap a topic or search by name.", "Serviço ou instituição": "Service or institution",
  "Nada encontrado. Experimente outra palavra.": "Nothing found. Try another word.", "opções": "options",
  "Consulta o valor": "Looks up the amount", "Valor à sua escolha": "Amount of your choice", "desde": "from",
  "Passo 1 de 2": "Step 1 of 2",
  // pagamento
  "Dados": "Details", "Confirmar": "Confirm", "Pagar": "Pay", "Confirme o valor": "Confirm the amount",
  "Como quer pagar?": "How do you want to pay?", "Valor": "Amount", "Comissão": "Fee", "Total a pagar": "Total to pay",
  "Paga pela instituição": "Paid by the institution", "Continuar para pagamento": "Continue to payment", "Alterar dados": "Edit details",
  "Consultar valor": "Look up amount", "Verificar e continuar": "Check and continue", "Valor a pagar (MT)": "Amount to pay (MT)",
  "Titular": "Holder", "Corrija os campos assinalados.": "Fix the highlighted fields.", "Preencha este campo.": "Fill in this field.",
  "Verifique o que escreveu.": "Check what you typed.", "Indique o valor.": "Enter the amount.",
  "Número do cartão": "Card number", "Validade": "Expiry", "Nome no cartão": "Name on card",
  "O número completo e o CVV não saem do seu telemóvel. O seu banco pode pedir um código de confirmação.":
    "The full number and CVV never leave your phone. Your bank may ask for a confirmation code.",
  "Pagamento": "Payment", "Pagamento confirmado": "Payment confirmed", "A aguardar pagamento": "Awaiting payment",
  "Confirme no seu banco": "Confirm with your bank", "Serviço": "Service", "Instituição": "Institution", "Método": "Method",
  "Estado": "Status", "Referência": "Reference", "Data": "Date", "Ver comprovativo (PDF)": "View receipt (PDF)",
  "Tentar de novo": "Try again", "Voltar ao início": "Back to home", "Copiar código": "Copy code",
  "Dados para pagar no banco": "Details to pay at the bank", "Entidade": "Entity", "Montante": "Amount",
  "Leia com a app do banco": "Scan with your bank app", "Código do seu banco": "Your bank's code",
  // verificar
  "Verificar comprovativo": "Verify receipt", "Código de verificação": "Verification code",
  "Confirme se um comprovativo é verdadeiro e se o pagamento continua válido. Não precisa de conta.":
    "Check whether a receipt is genuine and the payment still valid. No account needed.",
  "Está impresso no comprovativo, ao lado do QR.": "It's printed on the receipt, next to the QR.",
  "Comprovativo autêntico": "Genuine receipt", "Não confirmado": "Not confirmed",
  // conta e perfil
  "Entre com o seu número": "Sign in with your number", "Receber código": "Get code", "Mudar de número": "Change number",
  "Número de telefone": "Phone number", "Código de 6 algarismos": "6-digit code",
  "Veja todos os seus pagamentos e comprovativos. Enviamos um código por SMS, sem palavra-passe.":
    "See all your payments and receipts. We send a code by SMS, no password.",
  "Os meus pagamentos": "My payments", "Pagos": "Paid", "Pendentes": "Pending", "Falhados": "Failed",
  "Ainda não pagou nada com esta conta.": "You haven't paid anything with this account yet.",
  "pagamentos concluídos": "payments completed", "Editar perfil": "Edit profile", "Nome": "First name", "Apelido": "Last name",
  "Email (opcional)": "Email (optional)", "Província": "Province", "Distrito": "District", "Escolha a província": "Choose the province",
  "Escolha o distrito": "Choose the district", "Perfil guardado.": "Profile saved.",
  // cadastro, início, perfil, notificações
  "Criar conta": "Create account", "Enviamos um código por SMS para confirmar que o número é seu.": "We'll text you a code to confirm the number is yours.",
  "Confirme o código": "Confirm the code", "Enviámos um código para": "We sent a code to", "Os seus dados": "Your details",
  "Para os comprovativos e lembretes da sua zona.": "For receipts and reminders in your area.", "Agora não": "Not now",
  "Número": "Number", "Código": "Code", "Concluir": "Finish",
  "Sem palavra-passe: entra sempre com o seu número.": "No password: you always sign in with your number.",
  "Os seus dados não são partilhados com terceiros.": "Your data is not shared with third parties.",
  "Pode pagar sem conta; a conta guarda o histórico.": "You can pay without an account; an account keeps your history.",
  "O que vamos pagar hoje? Sem filas, com comprovativo na hora.": "What are we paying today? No queues, instant receipt.",
  "Pesquisar": "Search", "no total": "in total", "Entre para ver": "Sign in to see",
  "Este mês": "This month", "Gastos por mês": "Spending per month", "6 meses": "6 months", "Onde pagou mais": "Where you paid most", "Outros": "Others",
  "Ver perfil, gráficos e histórico": "See profile, charts and history", "Criar conta ou entrar": "Create account or sign in",
  "Guarde o histórico e os comprovativos.": "Keep your history and receipts.",
  "Entre para receber o estado dos seus pagamentos aqui.": "Sign in to get your payment updates here.", "Sem notificações por agora.": "No notifications for now.",
  "Fotografia do início": "Home photo", "Mudar foto": "Change photo", "Escolher foto": "Choose photo", "Tirar foto": "Take photo", "Remover": "Remove",
  "Autorize o acesso às fotos nas definições do telemóvel.": "Allow photo access in your phone settings.",
  // definições
  "Aparência": "Appearance", "Tema": "Theme", "Automático": "Automatic", "Claro": "Light", "Escuro": "Dark",
  "Idioma": "Language", "Português": "Portuguese", "Notificações": "Notifications",
  "Pagamentos confirmados": "Confirmed payments", "Lembretes de faturas": "Bill reminders",
  "Segurança": "Security", "Pedir biometria ao abrir": "Ask for biometrics on open", "Vibração ao tocar": "Haptic feedback",
  "Privacidade": "Privacy", "Estatísticas de uso anónimas": "Anonymous usage statistics",
  "Política de privacidade": "Privacy policy", "Termos de utilização": "Terms of use", "Apagar dados deste aparelho": "Clear data on this device",
  "Ajuda": "Help", "Perguntas frequentes": "FAQ", "Contactar apoio": "Contact support", "Sobre": "About", "Versão": "Version",
  "Ver boas-vindas outra vez": "Show welcome again", "Dados apagados.": "Data cleared.",
};

export function t(pt: string): string {
  return lang === "en" ? EN[pt] ?? pt : pt;
}
