export const metadata = { title: "Sem conexão — PrivateSocial" };

export default function OfflinePage() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-6"
      style={{ minHeight: "100dvh" }}
    >
      <div
        className="display gold-text"
        style={{ fontSize: 42, fontWeight: 500, lineHeight: 1.1 }}
      >
        PrivateSocial
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "var(--text-2)",
          marginTop: 8,
        }}
      >
        Private Circle
      </div>
      <div
        style={{
          width: 40,
          height: 1,
          background: "var(--gold-600)",
          margin: "24px auto",
          opacity: 0.5,
        }}
      />
      <div
        style={{ fontSize: 15, color: "var(--text-1)", lineHeight: 1.6 }}
      >
        Você está sem conexão.
        <br />
        Verifique seu Wi-Fi ou dados móveis
        <br />e tente novamente.
      </div>
      <a
        href="/"
        className="btn-gold mt-8"
        style={{ padding: "11px 28px", textDecoration: "none" }}
      >
        Tentar novamente
      </a>
    </div>
  );
}
