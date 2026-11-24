#!/usr/bin/env node
/**
 * make-admin.mjs — Promove um usuário existente a admin do PrivateSocial.
 *
 * Uso:
 *   npm run make-admin -- <email> [--nivel super|moderador]
 *
 * Pré-requisitos:
 *   - Usuário já precisa ter se cadastrado em seu-app.vercel.app
 *   - SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_SUPABASE_URL no .env.local
 *
 * Exemplos:
 *   npm run make-admin -- admin@exemplo.com
 *   npm run make-admin -- fulano@exemplo.com --nivel moderador
 *
 * Nota: o script lê o .env.local diretamente (não via --env-file), pra
 * ignorar eventuais vars conflitantes exportadas no shell.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const nivelIdx = args.indexOf("--nivel");
const nivel = nivelIdx >= 0 ? args[nivelIdx + 1] : "super";

if (!email) {
  console.error("❌ Passe o email: npm run make-admin -- <email>");
  process.exit(1);
}
if (!["super", "moderador"].includes(nivel)) {
  console.error("❌ Nível inválido. Use 'super' ou 'moderador'.");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Lê .env.local diretamente (sobrescreve o que já estiver no shell)   */
/* ------------------------------------------------------------------ */
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
let envRaw;
try {
  envRaw = readFileSync(envPath, "utf8");
} catch {
  console.error(`❌ .env.local não encontrado em ${envPath}`);
  process.exit(1);
}
const env = Object.fromEntries(
  envRaw
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const [k, ...rest] = line.split("=");
      return [k.trim(), rest.join("=").trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY faltando no .env.local",
  );
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

/* ------------------------------------------------------------------ */
/* 1. Busca o user em auth.users pelo email                            */
/* ------------------------------------------------------------------ */
console.log(`🔍 Buscando ${email}…`);
const listRes = await fetch(`${url}/auth/v1/admin/users?per_page=200`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!listRes.ok) {
  console.error(`❌ Falha ao listar users: ${listRes.status}`);
  process.exit(1);
}
const list = await listRes.json();
const user = (list.users || []).find((u) => u.email === email);
if (!user) {
  console.error(
    `❌ Nenhum usuário com email ${email}. Peça pra ela(e) se cadastrar em seu-app.vercel.app primeiro.`,
  );
  process.exit(1);
}
console.log(`✓ User encontrado: ${user.id}`);

/* ------------------------------------------------------------------ */
/* 2. Garante profile (o trigger on_auth_user_created deveria ter      */
/*    criado, mas há casos em que não dispara — fallback seguro)        */
/* ------------------------------------------------------------------ */
const profileRes = await fetch(`${url}/rest/v1/profiles`, {
  method: "POST",
  headers: { ...headers, Prefer: "resolution=merge-duplicates" },
  body: JSON.stringify({ id: user.id }),
});
if (!profileRes.ok && profileRes.status !== 201 && profileRes.status !== 200) {
  console.error(
    `⚠️  Profile não pôde ser criado (${profileRes.status}): ${await profileRes.text()}`,
  );
  // Continua mesmo assim — pode já existir
}

/* ------------------------------------------------------------------ */
/* 3. Promove a admin (upsert com resolução merge-duplicates)          */
/* ------------------------------------------------------------------ */
const adminRes = await fetch(`${url}/rest/v1/admins`, {
  method: "POST",
  headers: {
    ...headers,
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify({ profile_id: user.id, nivel }),
});
const adminBody = await adminRes.text();
if (!adminRes.ok) {
  console.error(`❌ Falha ao promover a admin: ${adminRes.status}`);
  console.error(adminBody);
  process.exit(1);
}

console.log(`\n✅ ${email} agora é admin (nível: ${nivel})`);
console.log(`   Acesse: https://seu-app.vercel.app/admin/moderacao`);
