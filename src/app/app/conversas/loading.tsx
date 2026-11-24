export default function ConversasLoading() {
  return (
    <div className="flex flex-col px-5 pt-10 gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="skel" style={{ width: 140, height: 30 }} />
        <div className="skel" style={{ width: 180, height: 14 }} />
      </div>

      {/* Novos matches */}
      <div className="flex flex-col gap-3">
        <div className="skel" style={{ width: 100, height: 10 }} />
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="skel" style={{ width: 68, height: 68, borderRadius: "50%" }} />
              <div className="skel" style={{ width: 44, height: 10 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Lista de conversas */}
      <div className="flex flex-col gap-3">
        <div className="skel" style={{ width: 120, height: 10 }} />
        <div className="skel rounded-2xl overflow-hidden" style={{ borderRadius: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < 4 ? "1px solid var(--line)" : "none" }}>
              <div className="skel flex-shrink-0" style={{ width: 52, height: 52, borderRadius: "50%" }} />
              <div className="flex flex-col gap-2 flex-1">
                <div className="skel" style={{ width: "55%", height: 14 }} />
                <div className="skel" style={{ width: "75%", height: 11 }} />
              </div>
              <div className="skel" style={{ width: 30, height: 11 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
