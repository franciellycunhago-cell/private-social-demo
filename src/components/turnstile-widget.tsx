"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          appearance?: "always" | "execute" | "interaction-only";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (err: string) => void;
        },
      ) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
    onloadTurnstile?: () => void;
  }
}

const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstile&render=explicit";

/* ====================================================================
 * TurnstileWidget — captcha visível da Cloudflare.
 *
 *  - appearance "always": user vê o widget e o estado de verificação.
 *    Mais confiável que interaction-only (que pode não popular o token
 *    se o user submete antes do desafio passar).
 *  - Token é populado num input hidden `cf-turnstile-response` que
 *    vai junto no FormData.
 *  - Sem sitekey → não renderiza (dev local).
 * ================================================================== */

export function TurnstileWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [erroLoad, setErroLoad] = useState<string | null>(null);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  // Kill-switch de emergência: se NEXT_PUBLIC_CAPTCHA_DISABLED=true,
  // não renderiza o widget (par com CAPTCHA_DISABLED no server)
  const disabled = process.env.NEXT_PUBLIC_CAPTCHA_DISABLED === "true";

  useEffect(() => {
    if (disabled) return;
    if (!sitekey) return;
    if (!containerRef.current) return;

    function render() {
      if (!containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: sitekey!,
          theme: "dark",
          appearance: "always",
          "error-callback": (err) => {
            setErroLoad(err || "erro");
          },
        });
      } catch (e) {
        setErroLoad(e instanceof Error ? e.message : "render falhou");
      }
    }

    if (window.turnstile) {
      render();
    } else {
      window.onloadTurnstile = render;
      const existing = document.querySelector(
        `script[src="${TURNSTILE_SCRIPT}"]`,
      );
      if (!existing) {
        const s = document.createElement("script");
        s.src = TURNSTILE_SCRIPT;
        s.async = true;
        s.defer = true;
        s.onerror = () => setErroLoad("falha ao carregar script");
        document.head.appendChild(s);
      }
    }

    return () => {
      const id = widgetIdRef.current;
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id);
        } catch {
          /* ignore */
        }
      }
      widgetIdRef.current = null;
    };
  }, [sitekey, disabled]);

  if (disabled) return null;
  if (!sitekey) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div ref={containerRef} className="cf-turnstile" />
      {erroLoad && (
        <div
          role="alert"
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--rose-400)",
            letterSpacing: 0.5,
          }}
        >
          Captcha não carregou: {erroLoad}. Confere se o domínio está
          autorizado no widget Turnstile.
        </div>
      )}
    </div>
  );
}
