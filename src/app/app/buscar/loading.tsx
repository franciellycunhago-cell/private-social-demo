export default function BuscarLoading() {
  return (
    <div className="flex flex-col px-5 pt-10 gap-5">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="skel" style={{ width: 160, height: 30 }} />
        <div className="skel" style={{ width: 200, height: 14 }} />
      </div>

      {/* Input */}
      <div className="skel" style={{ height: 48, borderRadius: 14 }} />

      {/* Resultados */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl" style={{ border: "1px solid var(--line)", background: "var(--bg-1)" }}>
          <div className="skel flex-shrink-0" style={{ width: 52, height: 52, borderRadius: "50%" }} />
          <div className="flex flex-col gap-2 flex-1">
            <div className="skel" style={{ width: "55%", height: 14 }} />
            <div className="skel" style={{ width: "35%", height: 11 }} />
            <div className="skel" style={{ width: "45%", height: 11 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
