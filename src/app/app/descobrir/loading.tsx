export default function DiscubrirLoading() {
  return (
    <div className="flex flex-col px-5 pt-10 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="skel" style={{ width: 120, height: 28 }} />
        <div className="skel" style={{ width: 60, height: 20, borderRadius: 20 }} />
      </div>

      {/* Banner evento */}
      <div className="skel" style={{ height: 140, borderRadius: 16 }} />

      {/* Stories */}
      <div className="flex gap-3 pt-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="skel" style={{ width: 68, height: 68, borderRadius: "50%" }} />
            <div className="skel" style={{ width: 44, height: 10 }} />
          </div>
        ))}
      </div>

      {/* Chips de filtro */}
      <div className="flex gap-2">
        {[60, 70, 80, 70].map((w, i) => (
          <div key={i} className="skel" style={{ width: w, height: 32, borderRadius: 20 }} />
        ))}
      </div>

      {/* Card de swipe */}
      <div className="skel" style={{ height: "52vh", borderRadius: 20 }} />
    </div>
  );
}
