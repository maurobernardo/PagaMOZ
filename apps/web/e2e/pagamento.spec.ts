import { expect, test, type Page } from "@playwright/test";

async function openService(page: Page, search: string, name: RegExp) {
  await page.goto("/");
  await expect(page.getByText("AMBIENTE DE DEMONSTRAÇÃO")).toBeVisible();
  await page.getByRole("searchbox", { name: "Pesquisar serviço" }).fill(search);
  await page.getByRole("button", { name: "Pesquisar" }).click();
  await page.getByRole("link", { name }).first().click();
}

async function payWithMpesa(page: Page, scenario = "sucesso") {
  await page.getByRole("button", { name: "Continuar para pagamento" }).click();
  await page.getByLabel("Número M-Pesa").fill("84 123 4567");
  await page.getByLabel("Cenário de demonstração").selectOption(scenario);
  await page.getByRole("button", { name: /^Pagar / }).click();
  await expect(page).toHaveURL(/\/pagamento\/PMZ[0-9A-Z]{10}$/);
}

test("nível 1: consultar fatura, pagar com M-Pesa e ver confirmação", async ({ page }) => {
  await openService(page, "electricidade", /Fatura de electricidade/);
  await page.getByLabel("N.º de contrato/cliente").fill("12345678");
  await page.getByRole("button", { name: "Consultar valor" }).click();

  await expect(page.getByRole("heading", { name: "Confirme o valor" })).toBeVisible();
  await expect(page.getByText(/Titular: .\*+/)).toBeVisible();
  const total = await page.locator("dt:has-text('Total a pagar') + dd").innerText();

  await payWithMpesa(page);
  await expect(page.getByRole("heading", { name: "Pagamento confirmado" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("dt:has-text('Total pago') + dd")).toHaveText(total);
});

test("validação: contrato inválido não avança", async ({ page }) => {
  await openService(page, "água", /Fatura de água/);
  await page.getByLabel("N.º de contrato/cliente").fill("12");
  await page.getByRole("button", { name: "Consultar valor" }).click();
  await expect(page.getByText("Formato inválido.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Confirme o valor" })).toBeHidden();
});

test("pagamento recusado pelo provedor mostra falha e permite repetir", async ({ page }) => {
  await openService(page, "inspecção", /Inspecção de veículo/);
  await page.getByLabel("Matrícula do veículo").fill("AAA-123-MC");
  await page.getByRole("button", { name: "Continuar" }).click();
  await payWithMpesa(page, "falha");
  await expect(page.getByRole("heading", { name: "Falhou" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Tentar de novo" })).toBeVisible();
});

test("nível 3: pedido com anexo, pagamento e acompanhamento", async ({ page }) => {
  await openService(page, "nascimento", /Certidão de nascimento/);
  await page.getByLabel("Nome completo").fill("Ana Demo");
  await page.getByLabel("Data de nascimento").fill("1990-01-01");
  await page.getByLabel("Cópia do documento de identificação").setInputFiles({
    name: "bi.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% demo\n"),
  });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/Pedido PED[0-9A-Z]{10}/)).toBeVisible();
  const code = (await page.getByText(/Pedido PED/).innerText()).match(/PED[0-9A-Z]{10}/)![0];

  await payWithMpesa(page);
  await expect(page.getByRole("heading", { name: "Pagamento confirmado" })).toBeVisible({ timeout: 20_000 });

  await page.goto("/");
  await page.getByLabel("Código do pagamento ou pedido").fill(code);
  await page.getByRole("button", { name: "Acompanhar" }).click();
  await expect(page).toHaveURL(`/pedido/${code}`);
  await expect(page.getByText("Submetido à instituição").first()).toBeVisible();
});

test("entrar com OTP, guardar na carteira e ver histórico", async ({ page }) => {
  const phone = `84${String(Date.now()).slice(-7)}`;
  await page.goto("/conta");
  await expect(page).toHaveURL(/\/entrar/);
  await page.getByLabel("Número de telemóvel").fill(phone);
  await page.getByRole("button", { name: "Receber código" }).click();
  const code = await page.locator("strong.font-mono").innerText();
  await page.getByLabel("Código").fill(code);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "A minha conta" })).toBeVisible();

  await openService(page, "água", /Fatura de água/);
  await page.getByLabel("N.º de contrato/cliente").fill("7654321");
  await page.getByRole("button", { name: "Consultar valor" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado na sua carteira.")).toBeVisible();
  await payWithMpesa(page);
  await expect(page.getByRole("heading", { name: "Pagamento confirmado" })).toBeVisible({ timeout: 20_000 });

  await page.goto("/conta");
  await expect(page.getByRole("heading", { name: "Carteira de obrigações" })).toBeVisible();
  await expect(page.getByText("7654321")).toBeVisible();
  await expect(page.getByRole("link", { name: /Fatura de água/ }).first()).toBeVisible();
});

test("comprovativo: descarregar PDF, verificar por código e detectar adulteração", async ({ page, request }) => {
  await openService(page, "inspecção", /Inspecção de veículo/);
  await page.getByLabel("Matrícula do veículo").fill("ABC-123-MP");
  await page.getByRole("button", { name: "Continuar" }).click();
  await payWithMpesa(page);
  await expect(page.getByRole("heading", { name: "Pagamento confirmado" })).toBeVisible({ timeout: 20_000 });

  const link = page.getByRole("link", { name: "Descarregar comprovativo (PDF)" });
  const pdf = await (await request.get((await link.getAttribute("href"))!)).body();
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

  // Por código (link na página de confirmação)
  await page.getByRole("link", { name: /^[2-9A-Z]{5}-[2-9A-Z]{5}$/ }).click();
  await expect(page.getByRole("heading", { name: "Comprovativo autêntico" })).toBeVisible();

  // Por ficheiro: original válido, adulterado recusado
  await page.goto("/verificar");
  await page.getByLabel("Carregar o PDF recebido").setInputFiles({ name: "c.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByRole("heading", { name: "Comprovativo autêntico" })).toBeVisible();

  const tampered = Buffer.from(pdf);
  tampered[Math.floor(tampered.length / 2)] ^= 0x01;
  await page.goto("/verificar");
  await page.getByLabel("Carregar o PDF recebido").setInputFiles({ name: "c.pdf", mimeType: "application/pdf", buffer: tampered });
  await expect(page.getByText(/não corresponde a nenhum comprovativo/)).toBeVisible();
});
