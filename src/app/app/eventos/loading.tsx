export default function EventosLoading() {
  return (
    <div className="flex flex-col px-5 pt-10 gap-5">
      {/* Header */}
      <div className="skel" style={{ width: 110, height: 30 }} />

      {/* Evento destaque */}
      <div className="skel" style={{ height: 200, borderRadius: 20 }} />

      {/* Chips */}
      <div className="flex gap-2">
        {[80, 90, 100].map((w, i) => (
          <div key={i} className="skel" style={{ width: w, height: 32, borderRadius: 20 }} />
        ))}
      </div>

      {/* Lista de eventos */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 items-center">
          <div className="skel flex-shrink-0" style={{ width: 80, height: 80, borderRadius: 12 }} />
          <div className="flex flex-col gap-2 flex-1">
            <div className="skel" style={{ width: "80%", height: 16 }} />
            <div className="skel" style={{ width: "55%", height: 12 }} />
            <div className="skel" style={{ width: "65%", height: 12 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
