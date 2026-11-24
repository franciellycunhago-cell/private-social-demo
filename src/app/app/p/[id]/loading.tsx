export default function ProfileLoading() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <div className="skel" style={{ height: 320, borderRadius: 0 }} />

      {/* Info */}
      <div className="px-5 pt-4 flex flex-col gap-3">
        <div className="skel" style={{ width: 170, height: 26 }} />
        <div className="skel" style={{ width: 110, height: 14 }} />

        {/* Chips intenções */}
        <div className="flex gap-2 flex-wrap">
          {[70, 90, 80, 60].map((w, i) => (
            <div key={i} className="skel" style={{ width: w, height: 26, borderRadius: 20 }} />
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 pt-2">
          {[60, 55, 65].map((w, i) => (
            <div key={i} className="skel" style={{ width: w, height: 14 }} />
          ))}
        </div>

        {/* Conteúdo */}
        <div className="grid grid-cols-3 gap-1 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skel" style={{ aspectRatio: "1", borderRadius: 8 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
