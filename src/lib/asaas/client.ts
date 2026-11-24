/**
 * Client minimalista pra API do Asaas (v3).
 *
 * Usa env vars:
 *  - ASAAS_API_KEY:    token começando com $aact_
 *  - ASAAS_BASE_URL:   https://sandbox.asaas.com/api/v3 (sandbox)
 *                      ou https://api.asaas.com/v3      (produção)
 *
 * Doc: https://docs.asaas.com/reference
 */

const TIMEOUT_MS = 12_000;

function getConfig() {
  const apiKey = process.env.ASAAS_API_KEY;
  const baseUrl = process.env.ASAAS_BASE_URL ?? "https://sandbox.asaas.com/api/v3";
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada");
  }
  return { apiKey, baseUrl };
}

/**
 * Wrapper de fetch que adiciona auth + timeout + parse seguro.
 * Lança Error com mensagem amigável em PT-BR pra cair no error handler.
 */
async function asaasFetch<T = unknown>(
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const { apiKey, baseUrl } = getConfig();

  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    access_token: apiKey,
    "User-Agent": "PrivateSocial/1.0",
  };

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errBody = (await res.json()) as {
        errors?: { code?: string; description?: string }[];
      };
      detail =
        errBody.errors?.map((e) => e.description).filter(Boolean).join("; ") ??
        "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(
      `Asaas ${res.status}: ${detail || res.statusText || "erro desconhecido"}`,
    );
  }

  return (await res.json()) as T;
}

/* ====================================================================
 * Customers
 * ================================================================== */

export type AsaasCustomer = {
  id: string;
  name: string;
  email: string | null;
  cpfCnpj: string | null;
};

/**
 * Busca customer existente por cpfCnpj. Asaas exige CPF único na conta,
 * então se já existe a gente reaproveita em vez de duplicar.
 */
export async function findCustomerByCpf(
  cpfCnpj: string,
): Promise<AsaasCustomer | null> {
  const sanitized = cpfCnpj.replace(/\D/g, "");
  const r = await asaasFetch<{ data: AsaasCustomer[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(sanitized)}`,
  );
  return r.data[0] ?? null;
}

export async function createCustomer(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
}): Promise<AsaasCustomer> {
  const cpf = input.cpfCnpj.replace(/\D/g, "");
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: {
      name: input.name,
      email: input.email,
      cpfCnpj: cpf,
      phone: input.phone,
      notificationDisabled: false,
    },
  });
}

/* ====================================================================
 * Subscriptions
 * ================================================================== */

export type AsaasSubscription = {
  id: string;
  customer: string;
  status: string;
  cycle: "MONTHLY" | "QUARTERLY" | "YEARLY";
  value: number;
  nextDueDate: string;
};

export type AsaasBillingType = "PIX" | "CREDIT_CARD" | "UNDEFINED";

/**
 * Cria assinatura recorrente. Pra trial 7 dias, passamos `nextDueDate`
 * como D+7 — Asaas só vai cobrar nessa data, dando o trial gratuito.
 *
 * billingType:
 *  - PIX:        gera QR code novo a cada ciclo (recomendado pra trial)
 *  - CREDIT_CARD: tokeniza o cartão na 1ª cobrança e renova automático
 *                 (melhor retenção). Cliente preenche cartão no checkout.
 *  - UNDEFINED:   deixa o cliente escolher na hora (NÃO recomendamos —
 *                 abre opção de boleto que tem taxa fixa alta pra valor
 *                 baixo de assinatura).
 */
export async function createSubscription(input: {
  customerId: string;
  cycle: "MONTHLY" | "QUARTERLY" | "YEARLY";
  valueCentavos: number;
  description: string;
  /** Forma de pagamento. Default PIX. */
  billingType?: AsaasBillingType;
  /** Default = D+7 (trial). Use D+0 pra cobrar imediato. */
  trialDays?: number;
  externalReference?: string;
}): Promise<AsaasSubscription> {
  const trialDays = input.trialDays ?? 7;
  const next = new Date();
  next.setDate(next.getDate() + trialDays);
  const nextDueDate = next.toISOString().slice(0, 10); // YYYY-MM-DD

  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: {
      customer: input.customerId,
      billingType: input.billingType ?? "PIX",
      cycle: input.cycle,
      value: input.valueCentavos / 100,
      nextDueDate,
      description: input.description,
      externalReference: input.externalReference,
      // Para cartão: 1 cobrança = R$ 9,90, sempre à vista (Asaas só
      // permite parcelar acima de R$ 10 + parcela mínima R$ 5).
    },
  });
}

export async function deleteSubscription(subscriptionId: string): Promise<void> {
  await asaasFetch<{ deleted: boolean }>(`/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });
}

/**
 * URL de pagamento da próxima cobrança da subscription. O Asaas gera
 * essa cobrança automaticamente perto do `nextDueDate`. Se ainda não
 * gerou (trial), mostramos um placeholder até o webhook confirmar.
 */
export async function getSubscriptionPaymentLink(
  subscriptionId: string,
): Promise<string | null> {
  type PaymentList = {
    data: { id: string; invoiceUrl?: string; bankSlipUrl?: string }[];
  };
  try {
    const r = await asaasFetch<PaymentList>(
      `/subscriptions/${subscriptionId}/payments?limit=1`,
    );
    const first = r.data[0];
    return first?.invoiceUrl ?? first?.bankSlipUrl ?? null;
  } catch {
    return null;
  }
}
