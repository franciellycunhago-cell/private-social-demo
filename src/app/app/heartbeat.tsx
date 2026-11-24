"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

/* ====================================================================
 * Heartbeat — client silencioso no /app layout que chama `mark_active`
 * a cada 60s. Sem isso, `ultimo_ativo` só atualiza em navegação entre
 * páginas (layout server component re-renderiza).
 *
 * Também dispara quando a aba volta a ficar visível (user abriu o app
 * após dormir o celular).
 * ================================================================== */

export function Heartbeat() {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function beat() {
      try {
        await supabase.rpc("mark_active");
      } catch {
        /* silencioso — é fire-and-forget */
      }
    }

    // Primeira batida depois de um pequeno delay (evita duplicar o
    // server-side mark_active que o layout.tsx já fez).
    const first = setTimeout(beat, 45_000);
    const interval = setInterval(beat, 60_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase]);

  return null;
}
