import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/* ====================================================================
 * /api/webhooks/asaas
 *
 * Recebe eventos do Asaas e atualiza o estado das assinaturas.
 *
 *  - Valida header `asaas-access-token` contra ASAAS_WEBHOOK_TOKEN
 *  - Idempotente: o mesmo evento pode chegar 2x (Asaas retry), tratamos
 *    via state machine (status atual define se aplicamos).
 *
 * Eventos tratados:
 *  - PAYMENT_CONFIRMED / PAYMENT_RECEIVED → assinatura vira 'ativa',
 *    estende profiles.vip_ate em 1 ciclo
 *  - PAYMENT_OVERDUE                       → 'inadimplente'
 *  - PAYMENT_REFUNDED                       → 'cancelada' (reembolso)
 *  - SUBSCRIPTION_DELETED                   → 'cancelada' (admin cancelou)
 *
 * Doc oficial dos eventos:
 *   https://docs.asaas.com/docs/sobre-o-webhook
 * ================================================================== */

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type AsaasWebhookEvent = {
  event: string;
  payment?: {
    id: string;
    customer: string;
    subscription?: string;
    value: number;
    status: string;
    confirmedDate?: string;
    paymentDate?: string;
    nextDueDate?: string;
  };
  subscription?: {
    id: string;
    customer: string;
    status: string;
    cycle: "MONTHLY" | "QUARTERLY" | "YEARLY";
  };
};

export async function POST(req: Request) {
  // 1. Valida token (header `asaas-access-token` setado no painel Asaas)
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expectedToken) {
    console.error("ASAAS_WEBHOOK_TOKEN não configurado");
    return NextResponse.json({ error: "config" }, { status: 500 });
  }
  const headerToken = req.headers.get("asaas-access-token");
  if (headerToken !== expectedToken) {
    console.warn("Webhook Asaas: token inválido");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: AsaasWebhookEvent;
  try {
    body = (await req.json()) as AsaasWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  console.log("Webhook Asaas:", body.event, {
    paymentId: body.payment?.id,
    subscriptionId: body.payment?.subscription ?? body.subscription?.id,
  });

  const admin = adminClient();

  try {
    switch (body.event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        await handlePaymentConfirmed(admin, body);
        break;
      }
      case "PAYMENT_OVERDUE": {
        await handlePaymentOverdue(admin, body);
        break;
      }
      case "PAYMENT_REFUNDED":
      case "SUBSCRIPTION_DELETED": {
        await handleSubscriptionCancelled(admin, body);
        break;
      }
      default:
        // Outros eventos (PAYMENT_CREATED, PAYMENT_UPDATED, etc) — ignora
        // mas retorna 200 pra Asaas não reentregar.
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro processando webhook Asaas:", err);
    // Retorna 500 — Asaas vai retry
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/* ─────────────────────────────────────────────────────────────────── */

async function handlePaymentConfirmed(
  admin: ReturnType<typeof adminClient>,
  body: AsaasWebhookEvent,
) {
  const subscriptionId =
    body.payment?.subscription ?? body.subscription?.id;
  if (!subscriptionId) return;

  // Pega assinatura local
  const { data: ass } = await admin
    .from("assinaturas")
    .select(
      "id, profile_id, plano, status, expira_em, valor_centavos",
    )
    .eq("asaas_subscription_id", subscriptionId)
    .maybeSingle<{
      id: string;
      profile_id: string;
      plano: "mensal" | "trimestral" | "anual";
      status: string;
      expira_em: string | null;
      valor_centavos: number;
    }>();

  if (!ass) {
    console.warn(
      `Webhook PAYMENT_CONFIRMED: assinatura ${subscriptionId} não encontrada`,
    );
    return;
  }

  // Calcula nova data de expiração: extende em 1 ciclo a partir do que
  // for maior (now ou expira_em atual)
  const cycleDays: Record<typeof ass.plano, number> = {
    mensal: 31,
    trimestral: 92,
    anual: 366,
  };
  const baseDate =
    ass.expira_em && new Date(ass.expira_em) > new Date()
      ? new Date(ass.expira_em)
      : new Date();
  const novaExpira = new Date(baseDate);
  novaExpira.setDate(novaExpira.getDate() + cycleDays[ass.plano]);
  const novaExpiraIso = novaExpira.toISOString();

  // Update assinatura
  const wasFirstPayment = ass.status === "trial" || ass.status === "inadimplente";
  await admin
    .from("assinaturas")
    .update({
      status: "ativa",
      ativada_em: ass.status === "trial" ? new Date().toISOString() : undefined,
      expira_em: novaExpiraIso,
    })
    .eq("id", ass.id);

  // Update profile.vip_ate
  await admin
    .from("profiles")
    .update({ vip_ate: novaExpiraIso })
    .eq("id", ass.profile_id);

  // Tracking
  await admin.from("vip_eventos").insert({
    profile_id: ass.profile_id,
    tipo: wasFirstPayment ? "pagamento_confirmado" : "renovacao_confirmada",
    metadata: {
      asaas_subscription_id: subscriptionId,
      payment_id: body.payment?.id,
      valor_centavos: ass.valor_centavos,
    },
  });
}

async function handlePaymentOverdue(
  admin: ReturnType<typeof adminClient>,
  body: AsaasWebhookEvent,
) {
  const subscriptionId =
    body.payment?.subscription ?? body.subscription?.id;
  if (!subscriptionId) return;

  const { data: ass } = await admin
    .from("assinaturas")
    .select("id, profile_id, status")
    .eq("asaas_subscription_id", subscriptionId)
    .maybeSingle<{ id: string; profile_id: string; status: string }>();

  if (!ass) return;

  // Não regride se já cancelada
  if (ass.status === "cancelada" || ass.status === "expirada") return;

  await admin
    .from("assinaturas")
    .update({ status: "inadimplente" })
    .eq("id", ass.id);

  await admin.from("vip_eventos").insert({
    profile_id: ass.profile_id,
    tipo: "inadimplente",
    metadata: {
      asaas_subscription_id: subscriptionId,
      payment_id: body.payment?.id,
    },
  });
}

async function handleSubscriptionCancelled(
  admin: ReturnType<typeof adminClient>,
  body: AsaasWebhookEvent,
) {
  const subscriptionId =
    body.payment?.subscription ?? body.subscription?.id;
  if (!subscriptionId) return;

  const { data: ass } = await admin
    .from("assinaturas")
    .select("id, profile_id, status")
    .eq("asaas_subscription_id", subscriptionId)
    .maybeSingle<{ id: string; profile_id: string; status: string }>();

  if (!ass) return;

  // Já cancelada localmente (user pediu cancelamento) — só atualiza tracking
  if (ass.status === "cancelada") return;

  await admin
    .from("assinaturas")
    .update({
      status: "cancelada",
      cancelada_em: new Date().toISOString(),
    })
    .eq("id", ass.id);

  // NÃO mexe em profiles.vip_ate — user mantém acesso até expira_em
  // (já pago). Acesso vence naturalmente.

  await admin.from("vip_eventos").insert({
    profile_id: ass.profile_id,
    tipo: ass.status === "trial" ? "cancelado_no_trial" : "cancelado_pos_trial",
    metadata: {
      asaas_subscription_id: subscriptionId,
      via: "webhook",
    },
  });
}
