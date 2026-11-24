"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/* ====================================================================
 * WatermarkedPhoto + WatermarkOverlay — img + overlay DOM com @handle.
 *
 * Não bloqueia print (impossível em web), mas se a foto vazar dá pra
 * rastrear de quem foi a captura. Usa DOM puro (divs em grid rotacionado)
 * em vez de SVG via data URI — funciona em todos browsers sem encoding.
 *
 * Variante ContainedPhotoWithWatermark: para fotos com objectFit:contain,
 * calcula a área visível real e aplica overlay só nela (sem vazar pras
 * faixas pretas que sobram quando aspect ratio difere do container).
 * ================================================================== */

export type WatermarkIntensity = "subtle" | "medium" | "strong";

// makeViewerToken vive em @/lib/watermark-token (sem "use client")
// pra poder ser importada em server components sem boundary issues.
export { makeViewerToken } from "@/lib/watermark-token";

/**
 * Overlay reutilizável que pode ser sobreposto a qualquer foto.
 * Pai precisa ter `position: relative` E `overflow: hidden`
 * (senão o transform scale vaza pra fora).
 */
export function WatermarkOverlay({
  label,
  intensity = "medium",
  rows = 9,
  cols = 5,
}: {
  label: string;
  intensity?: WatermarkIntensity;
  rows?: number;
  cols?: number;
}) {
  const total = rows * cols;
  const fontOpacity =
    intensity === "subtle" ? 0.1 : intensity === "strong" ? 0.22 : 0.15;
  const shadowOpacity =
    intensity === "subtle" ? 0.18 : intensity === "strong" ? 0.4 : 0.25;

  // Grid sem scale extra — preenche exatamente o container.
  // A inclinação fica via grid + um nudge horizontal por linha pra
  // dar visual de "diagonal" sem vazar com transform:scale.
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const row = Math.floor(i / cols);
        // Cada linha desloca um pouco — efeito "tijolo deslizado"
        // em vez de rotate, evita transform vazar
        const shiftX = (row % 2 === 0 ? 0 : 8);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateX(${shiftX}px) rotate(-15deg)`,
              transformOrigin: "center center",
              color: `rgba(255,255,255,${fontOpacity})`,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: 0.8,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              textShadow: `0 0 2px rgba(0,0,0,${shadowOpacity})`,
              whiteSpace: "nowrap",
              userSelect: "none",
              overflow: "hidden",
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

export function WatermarkedPhoto({
  src,
  alt,
  label,
  className,
  style,
  intensity = "medium",
  imgFit = "cover",
}: {
  src: string;
  alt: string;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  intensity?: WatermarkIntensity;
  imgFit?: "cover" | "contain";
}) {
  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`.trim()}
      style={style}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        className="no-save absolute inset-0 w-full h-full"
        style={{
          objectFit: imgFit,
          userSelect: "none",
          WebkitTouchCallout: "none",
        }}
      />
      <WatermarkOverlay label={label} intensity={intensity} />
    </div>
  );
}

/**
 * Variante para foto com objectFit:contain. Calcula client-side a
 * área real ocupada pela imagem (sem as faixas pretas) e aplica o
 * overlay só nessa área. Re-calcula em onLoad e em resize.
 *
 * Pai precisa ter posição/dimensão definidas (ex: width/height fixos
 * ou flex-grow + height min).
 */
export function ContainedPhotoWithWatermark({
  src,
  alt,
  label,
  intensity = "subtle",
  className,
  style,
}: {
  src: string;
  alt: string;
  label: string;
  intensity?: WatermarkIntensity;
  className?: string;
  style?: React.CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgBox, setImgBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const recalc = useCallback(() => {
    const c = containerRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!cw || !ch || !nw || !nh) return;
    const imgRatio = nw / nh;
    const cRatio = cw / ch;
    let w: number;
    let h: number;
    if (imgRatio > cRatio) {
      w = cw;
      h = cw / imgRatio;
    } else {
      h = ch;
      w = ch * imgRatio;
    }
    setImgBox({
      left: (cw - w) / 2,
      top: (ch - h) / 2,
      width: w,
      height: h,
    });
  }, []);

  useEffect(() => {
    recalc();
    const onResize = () => recalc();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recalc]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className ?? ""}`.trim()}
      style={style}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={recalc}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        className="no-save absolute inset-0 w-full h-full"
        style={{
          objectFit: "contain",
          userSelect: "none",
          WebkitTouchCallout: "none",
        }}
      />
      {imgBox && (
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: imgBox.left,
            top: imgBox.top,
            width: imgBox.width,
            height: imgBox.height,
            overflow: "hidden",
          }}
        >
          <WatermarkOverlay label={label} intensity={intensity} />
        </div>
      )}
    </div>
  );
}
