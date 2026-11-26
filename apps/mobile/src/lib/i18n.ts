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
  "Avisos com a app fechada precisam da versão instalada da app (não o Expo Go).": "Alerts with the app closed need the installed app (not Expo Go).",
  "Pague sem filas": "Pay without queues", "Pago este mês": "Paid this month", "Comece agora": "Get started", "pagamentos": "payments",
  "Histórico e comprovativos guardados": "History and receipts saved", "Acompanhar": "Track", "Recarga": "Top-up",
  "A funcionar bem agora": "Working well now", "Com falhas agora": "Failing now", "Instável agora": "Unstable now",
  "Lemos estes dados da sua fatura. Confirme se estão certos antes de continuar.": "We read these details from your bill. Check them before continuing.",
  "Contas da casa": "Home bills", "O que costuma pagar e quando volta a vencer.": "What you usually pay and when it's due again.",
  "Fotografe e pague": "Snap and pay", "Tire uma foto da fatura e nós preenchemos o resto.": "Take a photo of the bill and we fill in the rest.",
  "Câmara": "Camera", "Galeria": "Gallery", "Próximas contas": "Upcoming bills", "Já passou": "Overdue", "Hoje": "Today", "Amanhã": "Tomorrow",
  "Daqui a": "In", "dias": "days", "Entre para vermos as suas contas que se repetem e avisarmos antes de vencerem.": "Sign in so we can track your recurring bills and remind you before they're due.",
  "Quando pagar a mesma conta duas vezes, ela aparece aqui com a próxima data.": "Once you pay the same bill twice, it shows up here with the next date.",
  "Datas estimadas a partir dos seus pagamentos. Avisamos 2 dias antes.": "Dates estimated from your payments. We remind you 2 days before.",
  "Energia Credelec": "Credelec power", "Contador": "Meter", "dias de energia": "days of power", "Cerca de": "About", "por mês": "per month",
  "Recarregar": "Top up", "Fotografar": "Snap", "Contas": "Bills",
  "Assistente": "Assistant", "«Paga 500 de Credelec»…": "“Pay 500 Credelec”…", "Escreva o que quer pagar…": "Type what you want to pay…",
  "Mensagem": "Message", "Enviar": "Send", "Olá! Diga-me o que quer pagar ou pergunte o que vence esta semana.": "Hi! Tell me what to pay or ask what's due this week.",
  "Verificar mensagem": "Check a message", "Isto é burla?": "Is this a scam?", "Colar": "Paste",
  "Cole a mensagem que recebeu (SMS ou WhatsApp). Mostramos os sinais de fraude.": "Paste the message you got (SMS or WhatsApp). We show the scam signs.",
  "Cole aqui a mensagem…": "Paste the message here…", "Recebeu uma mensagem suspeita?": "Got a suspicious message?", "Verificamos se tem sinais de burla.": "We check it for scam signs.",
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
