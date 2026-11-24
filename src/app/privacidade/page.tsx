import Link from "next/link";

export const metadata = {
  title: "Política de privacidade — PrivateSocial",
};

/* ====================================================================
 * /privacidade
 *
 * Política de privacidade conforme LGPD (Lei 13.709/2018).
 * Texto em PT-BR, complementa /termos. Mostra dados coletados,
 * finalidade, base legal, retenção e direitos do titular.
 * ================================================================== */

export default function PrivacidadePage() {
  return (
    <div
      className="mx-auto"
      style={{ maxWidth: 720, padding: "48px 24px 80px" }}
    >
      <Link
        href="/app/perfil"
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 2,
          color: "var(--text-3)",
          textDecoration: "none",
          textTransform: "uppercase",
        }}
      >
        ‹ Voltar
      </Link>

      <h1
        className="display"
        style={{
          fontSize: 32,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          marginTop: 14,
        }}
      >
        Política de privacidade
      </h1>
      <p
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginTop: 4,
        }}
      >
        Última atualização: 26 de abril de 2026 · Conforme LGPD
      </p>

      <div
        style={{
          fontSize: 14,
          color: "var(--text-1)",
          lineHeight: 1.7,
          marginTop: 32,
        }}
      >
        <Section title="1. Quem somos">
          PrivateSocial é uma comunidade fechada e exclusiva pra adultos
          maiores de 18 anos, voltada a casais e solteiros. Operamos sob
          legislação brasileira. Pra qualquer questão sobre seus dados,
          escreva pra{" "}
          <a
            href="mailto:contact@example.com"
            style={{ color: "var(--gold-300)" }}
          >
            contact@example.com
          </a>
          .
        </Section>

        <Section title="2. Quais dados coletamos">
          <ul style={{ paddingLeft: 22, margin: 0 }}>
            <li>
              <b>Identificação</b>: nome de exibição, @handle, idade, cidade
              e estado, tipo de perfil (casal/solteiro), bio e intenções.
            </li>
            <li>
              <b>Conta</b>: email e senha (esta criptografada).
            </li>
            <li>
              <b>Verificação</b>: selfie segurando código que você envia uma
              vez no cadastro pra moderação confirmar identidade real.
            </li>
            <li>
              <b>Conteúdo gerado</b>: fotos públicas e privadas, posts,
              stories, comentários, mensagens em conversas, denúncias.
            </li>
            <li>
              <b>Interações</b>: matches, curtidas, pedidos de acesso a
              privadas, eventos confirmados, check-ins.
            </li>
            <li>
              <b>Técnicos</b>: IP, agente de navegador, último acesso. Sem
              cookies de rastreamento de terceiros (Google, Facebook etc).
            </li>
          </ul>
        </Section>

        <Section title="3. Pra quê usamos seus dados">
          <ul style={{ paddingLeft: 22, margin: 0 }}>
            <li>
              Operar o app: mostrar perfis, casar matches, entregar
              mensagens, processar pedidos de acesso.
            </li>
            <li>
              Verificação de identidade pra manter a comunidade segura
              (combate a perfil falso, menor de idade, automação).
            </li>
            <li>
              Moderação: revisar denúncias e tomar ações (suspender, banir,
              apagar conteúdo violador).
            </li>
            <li>
              Marca d&apos;água nas fotos privadas com seu @ID curto pra
              rastreabilidade em caso de vazamento.
            </li>
            <li>
              Estatísticas internas agregadas (ex: total de matches por
              cidade) — sem identificar usuários individualmente fora do
              app.
            </li>
          </ul>
        </Section>

        <Section title="4. Base legal (LGPD)">
          Tratamos dados pessoais com fundamento em (a) consentimento do
          titular ao se cadastrar e aceitar este termo; (b) execução de
          contrato (entregar o serviço); (c) legítimo interesse na
          segurança da comunidade (moderação, antifraude); (d) cumprimento
          de obrigação legal quando aplicável.
        </Section>

        <Section title="5. Compartilhamento">
          Não vendemos seus dados. Não enviamos a terceiros pra
          marketing. Compartilhamos apenas:
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <b>Outros membros do app</b>, conforme as regras de
              visibilidade que você controla (perfil público vs fotos
              privadas vs mensagens entre matches).
            </li>
            <li>
              <b>Provedores essenciais</b>: Supabase (banco e storage,
              hospedados em ambiente seguro), Vercel (hospedagem do app),
              Resend ou similar (email transacional). Operam sob seus
              próprios termos e segurança.
            </li>
            <li>
              <b>Autoridades</b>: quando obrigatório por ordem judicial ou
              determinação legal.
            </li>
          </ul>
        </Section>

        <Section title="6. Retenção e exclusão">
          Mantemos seus dados enquanto sua conta estiver ativa. Você pode
          excluir sua conta a qualquer momento via{" "}
          <Link href="/app/perfil" style={{ color: "var(--gold-300)" }}>
            Perfil → Excluir conta
          </Link>
          . Após pedido de exclusão:
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              A conta entra em <b>período de carência de 7 dias</b> em que
              é possível reverter.
            </li>
            <li>
              Após o prazo, todos os seus dados são apagados em definitivo
              do banco e do storage (perfil, fotos, posts, stories,
              mensagens enviadas, matches, curtidas).
            </li>
            <li>
              Mensagens já entregues a outros membros não são apagadas do
              lado dos destinatários (privacidade deles).
            </li>
            <li>
              Dados que precisamos manter por obrigação legal (ex: logs
              fiscais futuros) ficam pelo prazo mínimo exigido, isolados.
            </li>
          </ul>
        </Section>

        <Section title="7. Seus direitos (art. 18 LGPD)">
          Você pode a qualquer momento:
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>Confirmar a existência de tratamento dos seus dados.</li>
            <li>Acessar e baixar seus dados (envie-nos a solicitação).</li>
            <li>Corrigir dados inexatos diretamente no app (Editar perfil).</li>
            <li>Solicitar anonimização ou exclusão (botão Excluir conta).</li>
            <li>Pedir portabilidade dos dados pra outro serviço.</li>
            <li>Revogar consentimento, gerando exclusão da conta.</li>
            <li>
              Reclamar à <b>ANPD</b> (Autoridade Nacional de Proteção de
              Dados) caso entenda que seus direitos não foram respeitados.
            </li>
          </ul>
          Pra qualquer dessas solicitações, escreva pra{" "}
          <a
            href="mailto:contact@example.com"
            style={{ color: "var(--gold-300)" }}
          >
            contact@example.com
          </a>
          . Respondemos em até 15 dias.
        </Section>

        <Section title="8. Segurança">
          Aplicamos medidas técnicas e organizacionais razoáveis pra
          proteger seus dados: criptografia em trânsito (HTTPS), senhas
          armazenadas com hash, separação entre fotos públicas e privadas
          (URLs assinadas com expiração curta), marca d&apos;água em fotos
          privadas pra rastreabilidade, RLS no banco de dados, controles
          de acesso administrativo. Apesar dos esforços, nenhum sistema é
          100% imune — comunique imediatamente qualquer incidente que
          identificar.
        </Section>

        <Section title="9. Menores">
          O PrivateSocial é proibido pra menores de 18 anos. Se
          identificarmos cadastro de menor, a conta é apagada
          imediatamente e os dados destruídos. Denúncias suspeitas vão
          às autoridades.
        </Section>

        <Section title="10. Mudanças nesta política">
          Podemos atualizar esta política conforme o serviço evolui ou a
          legislação muda. Mudanças relevantes são comunicadas no app
          antes de entrar em vigor.
        </Section>

        <p
          style={{
            marginTop: 32,
            fontSize: 12,
            color: "var(--text-3)",
            textAlign: "center",
          }}
        >
          <Link
            href="/termos"
            style={{ color: "var(--gold-300)", textDecoration: "underline" }}
          >
            Ler termo de uso
          </Link>{" "}
          · PrivateSocial · Brasil
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        className="display"
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "var(--gold-300)",
          marginBottom: 8,
        }}
      >
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}
