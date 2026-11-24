import Link from "next/link";

export const metadata = {
  title: "Termo de uso — PrivateSocial",
};

/* ====================================================================
 * /termos
 *
 * Página estática com termo de uso. Linkada do modal de aviso de
 * fotos privadas e do rodapé. Texto em PT-BR.
 * ================================================================== */

export default function TermosPage() {
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
        Termo de uso
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
        Última atualização: 25 de abril de 2026
      </p>

      <div
        style={{
          fontSize: 14,
          color: "var(--text-1)",
          lineHeight: 1.7,
          marginTop: 32,
        }}
      >
        <Section title="1. Quem pode usar">
          O PrivateSocial é uma comunidade exclusiva para maiores de 18
          anos, voltada a casais e solteiros adultos interessados em encontros
          consensuais e relações afetivas/sexuais entre adultos. Ao se
          cadastrar, você declara ter ao menos 18 anos completos e ter capacidade
          civil plena.
        </Section>

        <Section title="2. Verificação e veracidade">
          A entrada na comunidade depende de aprovação manual da nossa equipe
          de moderação, com base em selfie de verificação enviada no cadastro.
          Você se compromete a usar identidade real, fotos próprias (de você
          ou do casal) e a não impersonar terceiros. Perfis falsos são banidos
          sem aviso e podem ser denunciados às autoridades.
        </Section>

        <Section title="3. Conteúdo e respeito">
          Toda foto, vídeo, post, story, comentário e mensagem publicados
          devem respeitar a dignidade das pessoas envolvidas. É proibido
          conteúdo com menores de idade, conteúdo não consensual, violência,
          discurso de ódio ou qualquer prática ilegal. Conteúdo desse tipo
          gera banimento permanente e pode ser reportado às autoridades
          competentes.
        </Section>

        <Section title="4. Fotos privadas e marca d'água">
          Fotos marcadas como <b>privadas</b> só ficam visíveis para perfis
          que receberam aprovação explícita do dono. Cada foto privada é
          renderizada com <b>marca d&apos;água dinâmica</b> contendo o
          @handle de quem está visualizando. Em caso de vazamento, conseguimos
          rastrear de qual conta partiu a captura.
        </Section>

        <Section title="5. Captura e redistribuição (proibido)">
          É <b>expressamente proibido</b> capturar (print, screenshot,
          gravação de tela) e redistribuir, de qualquer forma e em qualquer
          plataforma, conteúdo privado de outros membros sem autorização
          expressa. Essa prática:
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>Viola este termo e gera banimento permanente da conta.</li>
            <li>
              Pode configurar crime de exposição de intimidade (Lei 13.718/2018,
              art. 218-C do Código Penal), com pena de 1 a 5 anos de reclusão.
            </li>
            <li>
              Sujeita o infrator a indenização cível por danos morais e
              materiais.
            </li>
          </ul>
          Ao tocar em &quot;Concordo e respeito&quot;, você reconhece estar
          ciente das consequências e se compromete a não capturar nem
          redistribuir conteúdo privado.
        </Section>

        <Section title="6. Bloqueio, denúncia e moderação">
          Você pode bloquear qualquer perfil a qualquer momento (sumimos do
          feed um do outro) e denunciar comportamentos abusivos. Nossa
          moderação revisa denúncias em até 48h. Decisões de banimento são
          finais, mas você pode contestar via{" "}
          <a
            href="mailto:contact@example.com"
            style={{ color: "var(--gold-300)" }}
          >
            contact@example.com
          </a>
          .
        </Section>

        <Section title="7. Privacidade e LGPD">
          Tratamos seus dados pessoais conforme a Lei Geral de Proteção de
          Dados (Lei 13.709/2018). Você pode solicitar a qualquer momento a
          exclusão da sua conta e dos seus dados. Detalhes em{" "}
          <Link
            href="/privacidade"
            style={{ color: "var(--gold-300)", textDecoration: "underline" }}
          >
            política de privacidade
          </Link>
          .
        </Section>

        <Section title="8. Mudanças nestes termos">
          Podemos atualizar este termo conforme a comunidade evolui. Mudanças
          relevantes serão comunicadas no app antes de entrarem em vigor. O
          uso continuado após a mudança implica aceitação.
        </Section>

        <p
          style={{
            marginTop: 32,
            fontSize: 12,
            color: "var(--text-3)",
            textAlign: "center",
          }}
        >
          PrivateSocial · Brasil
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
