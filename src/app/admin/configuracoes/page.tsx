import {
  getChatAberto,
  getFotoObrigatoria,
} from "@/lib/app-settings/server";
import { toggleChatAberto, toggleFotoObrigatoria } from "./actions";

export const metadata = {
  title: "Configurações — Admin PrivateSocial",
};

/* ====================================================================
 * /admin/configuracoes
 *
 * Toggles de feature flags runtime. Hoje:
 *  - Chat aberto: libera botão "Conversar" no perfil pra todo mundo,
 *    não só pra quem tem match. Útil pra forçar interação no early
 *    stage. Quando massa crítica de matches reais existir, desligar.
 * ================================================================== */

export default async function AdminConfiguracoesPage() {
  const [chatAberto, fotoObrigatoria] = await Promise.all([
    getChatAberto(),
    getFotoObrigatoria(),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1
          className="display"
          style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" }}
        >
          Configurações
        </h1>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-2)",
            marginTop: 4,
          }}
        >
          Feature flags que você pode mexer sem precisar de deploy.
        </div>
      </div>

      <section
        className="rounded-2xl p-5"
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-0)",
              }}
            >
              Chat aberto pra todos
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-2)",
                marginTop: 4,
                lineHeight: 1.5,
                maxWidth: 460,
              }}
            >
              Quando ligado, qualquer user pode iniciar uma conversa direto
              do perfil de outro user, sem precisar de match. Ideal pra
              fase inicial onde queremos forçar interação. Desligue quando
              o app já tiver volume suficiente de matches naturais.
            </div>

            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginTop: 12,
                color: chatAberto ? "var(--gold-300)" : "var(--text-3)",
              }}
            >
              Status: {chatAberto ? "● ligado" : "○ desligado"}
            </div>
          </div>

          <form action={toggleChatAberto}>
            <input
              type="hidden"
              name="ativar"
              value={chatAberto ? "false" : "true"}
            />
            <button
              type="submit"
              className={chatAberto ? "btn-ghost" : "btn-gold"}
              style={{
                padding: "10px 18px",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              {chatAberto ? "Desligar" : "Ligar"}
            </button>
          </form>
        </div>
      </section>

      <section
        className="rounded-2xl p-5"
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-0)",
              }}
            >
              Mínimo de 3 fotos (5 dias de cortesia)
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-2)",
                marginTop: 4,
                lineHeight: 1.5,
                maxWidth: 460,
              }}
            >
              Quando ligado, o user tem 5 dias após aprovação pra atingir
              pelo menos 3 conteúdos com foto. Vale qualquer combinação:
              fotos do perfil + publicações com foto. Durante o período
              vê um banner lembrando. Passados os 5 dias sem o mínimo, é
              redirecionado pra tela de upload e fica travado até
              completar. Admins bypassam. Evita perfis fake que só espiam.
            </div>

            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginTop: 12,
                color: fotoObrigatoria
                  ? "var(--gold-300)"
                  : "var(--text-3)",
              }}
            >
              Status: {fotoObrigatoria ? "● ligado" : "○ desligado"}
            </div>
          </div>

          <form action={toggleFotoObrigatoria}>
            <input
              type="hidden"
              name="ativar"
              value={fotoObrigatoria ? "false" : "true"}
            />
            <button
              type="submit"
              className={fotoObrigatoria ? "btn-ghost" : "btn-gold"}
              style={{
                padding: "10px 18px",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              {fotoObrigatoria ? "Desligar" : "Ligar"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
