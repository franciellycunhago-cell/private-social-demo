"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  createCustomer,
  createSubscription,
  deleteSubscription,
  findCustomerByCpf,
  getSubscriptionPaymentLink,
  type AsaasBillingType,
} from "@/lib/asaas/client";
import { PLANOS_INFO, type VipPlano } from "./planos";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ====================================================================
 * /app/vip — server actions
 *
 *  - registrarPageVisitada(): grava `vip_eventos` (page_visitada)
 *  - iniciarTrial(plano, cpf): cria customer + subscription Asaas com
 *    trial 7 dias, persiste em `assinaturas`, retorna URL de checkout
 *  - cancelarMinhaAssinatura(): user cancela a própria
 *
 * Asaas v3 — reutiliza customer existente por CPF pra evitar duplicar.
 * ================================================================== */

export async function registrarPageVisitada(): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Não grava se viu na última hora pra não inflar dados
    const { data: ultimo } = await supabase
      .from("vip_eventos")
      .select("created_at")
      .eq("profile_id", user.id)
      .eq("tipo", "page_visitada")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string }>();

    if (ultimo) {
      const elapsedMs = Date.now() - new Date(ultimo.created_at).getTime();
      if (elapsedMs < 60 * 60 * 1000) return; // <1h, ignora
    }

    await supabase.from("vip_eventos").insert({
      profile_id: user.id,
      tipo: "page_visitada",
    });
  } catch {
    // Tracking não pode quebrar a experiência
  }
}

/**
 * Validação básica de CPF (sanidade — Asaas faz validação completa).
 * Aceita só dígitos OU formato 000.000.000-00.
 */
function cpfValido(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // 11111111111 etc
  // Algoritmo dos dígitos verificadores
  const calc = (slice: string, factor: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice[i]!, 10) * (factor - i);
    }
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(digits.slice(0, 9), 10);
  const d2 = calc(digits.slice(0, 10), 11);
  return d1 === parseInt(digits[9]!, 10) && d2 === parseInt(digits[10]!, 10);
}

export type FormaPagamento = "pix" | "cartao";

export async function iniciarTrial(
  plano: VipPlano,
  cpf: string,
  forma: FormaPagamento,
): Promise<
  { ok: true; checkoutUrl: string | null; assinaturaId: string } | { error: string }
> {
  // Validação de input
  if (!["mensal", "trimestral", "anual"].includes(plano)) {
    return { error: "Plano inválido." };
  }
  if (forma !== "pix" && forma !== "cartao") {
    return { error: "Forma de pagamento inválida." };
  }
  if (!cpfValido(cpf)) {
    return { error: "CPF inválido. Confere os números." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou. Faça login de novo." };

  // Confere se já não é VIP
  const { data: profile } = await supabase
    .from("profiles")
    .select("vip_ate, nome_exibicao")
    .eq("id", user.id)
    .maybeSingle<{ vip_ate: string | null; nome_exibicao: string | null }>();
  if (profile?.vip_ate && new Date(profile.vip_ate) > new Date()) {
    return { error: "Você já é VIP." };
  }

  if (!process.env.ASAAS_API_KEY) {
    return {
      error:
        "O sistema de pagamento ainda está em configuração. Tenta de novo em alguns minutos.",
    };
  }

  const planoInfo = PLANOS_INFO[plano];
  const cycleMap: Record<VipPlano, "MONTHLY" | "QUARTERLY" | "YEARLY"> = {
    mensal: "MONTHLY",
    trimestral: "QUARTERLY",
    anual: "YEARLY",
  };

  const admin = adminClient();

  try {
    // 1. Cria/reusa customer no Asaas (busca por CPF, se já existe usa)
    let customer = await findCustomerByCpf(cpf);
    if (!customer) {
      customer = await createCustomer({
        name: profile?.nome_exibicao ?? "Membro PrivateSocial",
        email: user.email ?? `user-${user.id}@example.com`,
        cpfCnpj: cpf,
      });
    }

    // 2. Cria subscription com trial 7d
    const billingType: AsaasBillingType =
      forma === "cartao" ? "CREDIT_CARD" : "PIX";
    const subscription = await createSubscription({
      customerId: customer.id,
      cycle: cycleMap[plano],
      valueCentavos: planoInfo.valorCentavos,
      description: `VIP PrivateSocial — ${plano}`,
      billingType,
      trialDays: 7,
      externalReference: user.id,
    });

    // 3. Persiste em assinaturas (status='trial')
    const trialFim = new Date();
    trialFim.setDate(trialFim.getDate() + 7);
    const { data: assinaturaInsert, error: insErr } = await admin
      .from("assinaturas")
      .insert({
        profile_id: user.id,
        asaas_customer_id: customer.id,
        asaas_subscription_id: subscription.id,
        plano,
        valor_centavos: planoInfo.valorCentavos,
        status: "trial",
        trial_inicio_em: new Date().toISOString(),
        trial_fim_em: trialFim.toISOString(),
        expira_em: trialFim.toISOString(), // vip_ate inicial = fim do trial
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("Erro inserindo assinatura:", insErr);
      // Rollback: cancela a subscription no Asaas pra não ficar pendente
      await deleteSubscription(subscription.id).catch(() => {});
      return { error: "Erro ao salvar assinatura. Tenta de novo." };
    }

    // 4. Já libera VIP até o fim do trial (vip_ate = trial_fim_em)
    await admin
      .from("profiles")
      .update({ vip_ate: trialFim.toISOString() })
      .eq("id", user.id);

    // 5. Tracking
    await admin.from("vip_eventos").insert({
      profile_id: user.id,
      tipo: "trial_iniciado",
      metadata: { plano, asaas_subscription_id: subscription.id },
    });

    // 6. URL de pagamento — durante trial pode não ter ainda.
    // Asaas gera a 1ª cobrança 24-48h antes do nextDueDate.
    const checkoutUrl = await getSubscriptionPaymentLink(subscription.id);

    return {
      ok: true,
      checkoutUrl,
      assinaturaId: assinaturaInsert.id as string,
    };
  } catch (err) {
    console.error("iniciarTrial Asaas error:", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Erro ao processar assinatura. Tenta de novo.",
    };
  }
}

export async function cancelarMinhaAssinatura(): Promise<
  { ok: true } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  // Pega assinatura ativa mais recente
  const { data: ass } = await supabase
    .from("assinaturas")
    .select("id, status, asaas_subscription_id, expira_em")
    .eq("profile_id", user.id)
    .in("status", ["trial", "ativa", "inadimplente"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      status: string;
      asaas_subscription_id: string | null;
      expira_em: string | null;
    }>();

  if (!ass) return { error: "Você não tem assinatura ativa." };

  const admin = adminClient();

  // Cancela no Asaas (se tiver ID — em sandbox pode não ter ainda)
  if (ass.asaas_subscription_id) {
    try {
      await deleteSubscription(ass.asaas_subscription_id);
    } catch (err) {
      console.error("Erro cancelando subscription Asaas:", err);
      // Mesmo se falhar no Asaas, marca como cancelada local
      // (webhook eventual pode contestar — mas raro)
    }
  }

  // Marca como cancelada no DB. Mantém vip_ate até expira_em (user
  // ainda tem acesso até o fim do período pago).
  await admin
    .from("assinaturas")
    .update({
      status: "cancelada",
      cancelada_em: new Date().toISOString(),
    })
    .eq("id", ass.id);

  // Tracking — diferencia se cancelou no trial ou pós-pago
  await admin.from("vip_eventos").insert({
    profile_id: user.id,
    tipo:
      ass.status === "trial" ? "cancelado_no_trial" : "cancelado_pos_trial",
    metadata: { asaas_subscription_id: ass.asaas_subscription_id },
  });

  return { ok: true };
}
