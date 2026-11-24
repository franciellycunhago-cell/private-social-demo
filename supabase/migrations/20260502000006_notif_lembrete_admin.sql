-- ============================================================
-- PrivateSocial — Tipo de notificação "lembrete_admin"
-- ============================================================
-- Pra admin disparar lembretes manuais (ex: "complete suas fotos").
-- Aparece no sininho do user e dispara push notification.
-- ============================================================

-- ALTER TYPE ADD VALUE não roda dentro de uma transação na maioria
-- dos clients SQL — por isso é uma migration isolada.
ALTER TYPE notificacao_tipo ADD VALUE IF NOT EXISTS 'lembrete_admin';
