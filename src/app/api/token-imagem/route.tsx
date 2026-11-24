import { ImageResponse } from "next/og";

// runtime nodejs é mais estável no Vercel pra ImageResponse — edge
// teve problemas no build de 28/04. Sem auth: token+nome via query
// params (token é público quando o user compartilha mesmo).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ====================================================================
 * GET /api/token-imagem?token=TC-XXXXXX&nome=Fulano
 *
 * Gera PNG 1080×1920 (story Instagram) com:
 *  - "PRIVATESOCIAL" no topo
 *  - Token gigante em destaque dourado
 *  - Nome do user
 *  - Footer "example.com"
 *
 * Recebe token + nome via query params (não precisa autenticar — token
 * é público de qualquer forma quando o user compartilha). Edge runtime
 * pra Satori/ImageResponse rodar mais leve.
 * ================================================================== */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tokenRaw = (url.searchParams.get("token") ?? "TC-XXXXXX")
      .toUpperCase()
      .slice(0, 12);
    const nomeRaw = (url.searchParams.get("nome") ?? "Membro").slice(0, 40);

    // Logo — URL absoluta pro Satori conseguir fetchar
    const logoUrl = `${url.origin}/wordmark.png`;

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0706",
            padding: "60px 60px",
          }}
        >
          {/* Logo — protagonista da imagem */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="Private Circle"
            width={680}
            height={680}
            style={{
              objectFit: "contain",
              marginBottom: 0,
            }}
          />

          {/* Subtitle */}
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: "#A38860",
              letterSpacing: 5,
              textTransform: "uppercase",
              marginBottom: 30,
            }}
          >
            Me acha no app
          </div>

          {/* Box do token — menor agora, dando protagonismo à logo */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "30px 60px",
              border: "3px solid #D4AF6E",
              borderRadius: 22,
              backgroundColor: "#1a0f05",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 18,
                color: "#A38860",
                letterSpacing: 3,
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              Meu token
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 72,
                color: "#F2D9A8",
                fontWeight: 800,
                letterSpacing: 5,
              }}
            >
              {tokenRaw}
            </div>
          </div>

          {/* Nome */}
          <div
            style={{
              display: "flex",
              fontSize: 32,
              color: "#D4AF6E",
              marginTop: 40,
              fontStyle: "italic",
            }}
          >
            — {nomeRaw}
          </div>

          {/* Spacer */}
          <div style={{ display: "flex", flex: 1 }} />

          {/* Rodapé */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "#A38860",
                letterSpacing: 2,
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              Cole esse código em "Buscar"
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 20,
                color: "#7d6644",
                letterSpacing: 5,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              example.com
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1920,
      },
    );
  } catch (err) {
    console.error("[token-imagem] erro:", err);
    return new Response(
      `Erro ao gerar imagem: ${err instanceof Error ? err.message : "desconhecido"}`,
      { status: 500 },
    );
  }
}
