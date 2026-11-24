export default function PerfilLoading() {
  return (
    <div className="flex flex-col items-center px-5 pt-10 gap-5">
      {/* Avatar */}
      <div className="skel" style={{ width: 220, height: 220, borderRadius: "50%" }} />

      {/* Nome */}
      <div className="flex flex-col items-center gap-2">
        <div className="skel" style={{ width: 160, height: 26 }} />
        <div className="skel" style={{ width: 110, height: 14 }} />
      </div>

      {/* Stats */}
      <div className="flex gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="skel" style={{ width: 36, height: 22 }} />
            <div className="skel" style={{ width: 50, height: 11 }} />
          </div>
        ))}
      </div>

      {/* Menu */}
      <div className="w-full flex flex-col gap-2 mt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skel" style={{ height: 52, borderRadius: 14 }} />
        ))}
      </div>
    </div>
  );
}
