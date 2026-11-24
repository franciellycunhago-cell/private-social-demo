"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  buscarRadar,
  salvarMinhaLocalizacao,
  type RadarPerfil,
} from "./actions";

/* ====================================================================
 * RadarClient — pede geolocation, salva no banco, lista perfis próximos.
 *
 * Estados:
 *  - "iniciando": ainda não pediu permissão (mostra CTA)
 *  - "carregando": esperando geolocation API
 *  - "permissao_negada": user negou (mostra instrução)
 *  - "buscando": tem localização, chamando RPC
 *  - "ok": lista carregada
 *  - "erro": exibe mensagem
 * ================================================================== */

type Estado =
  | { kind: "iniciando" }
  | { kind: "carregando" }
  | { kind: "permissao_negada" }
  | { kind: "buscando"; lat: number; lng: number }
  | { kind: "ok"; lat: number; lng: number; perfis: RadarPerfil[] }
  | { kind: "erro"; mensagem: string };

const RAIO_PADRAO_KM = 50;

export function RadarClient({
  meuVisivel,
  tinhaGeo,
}: {
  meuVisivel: boolean;
  tinhaGeo: boolean;
}) {
  const [estado, setEstado] = useState<Estado>({ kind: "iniciando" });
  const [raioKm, setRaioKm] = useState(RAIO_PADRAO_KM);
  const [tipoFiltro, setTipoFiltro] = useState<
    "todos" | "casal" | "homem" | "mulher"
  >("todos");
  const [pending, startTransition] = useTransition();

  function pedirLocalizacao() {
    if (!("geolocation" in navigator)) {
      setEstado({
        kind: "erro",
        mensagem: "Seu navegador não suporta localização.",
      });
      return;
    }
    setEstado({ kind: "carregando" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // Salva no banco e aguarda resultado — se der erro, mostra.
        // Sem await, save falhava em silêncio e geo_loc nunca persistia.
        const r = await salvarMinhaLocalizacao(lat, lng);
        if ("error" in r) {
          setEstado({
            kind: "erro",
            mensagem: `Falha ao salvar localização: ${r.error}`,
          });
          return;
        }
        setEstado({ kind: "buscando", lat, lng });
        carregarPerfis(lat, lng);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setEstado({ kind: "permissao_negada" });
        } else {
          setEstado({
            kind: "erro",
            mensagem:
              err.code === err.TIMEOUT
                ? "Demorou demais pra pegar sua localização. Tenta de novo."
                : "Não consegui pegar sua localização.",
          });
        }
      },
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60_000, // 5 minutos de cache pra reduzir prompts
        timeout: 12_000,
      },
    );
  }

  function carregarPerfis(lat: number, lng: number, novoRaio = raioKm) {
    startTransition(async () => {
      const r = await buscarRadar(lat, lng, novoRaio, 60);
      if ("error" in r) {
        setEstado({ kind: "erro", mensagem: r.error });
      } else {
        setEstado({ kind: "ok", lat, lng, perfis: r.perfis });
      }
    });
  }

  // Auto-trigger só se a permissão JÁ está granted (pra evitar
  // mostrar prompt toda vez que a página recarrega). Se o user
  // ainda não permitiu, mantém o CTA manual.
  useEffect(() => {
    if (!tinhaGeo) return;
    if (typeof navigator === "undefined") return;
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((p) => {
          if (p.state === "granted") {
            pedirLocalizacao();
          } else if (p.state === "denied") {
            setEstado({ kind: "permissao_negada" });
          }
          // "prompt": deixa o user clicar no CTA
        })
        .catch(() => {
          // Permissions API indisponível — tenta direto
          pedirLocalizacao();
        });
    } else {
      pedirLocalizacao();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trocarRaio(novo: number) {
    setRaioKm(novo);
    if (estado.kind === "ok") {
      carregarPerfis(estado.lat, estado.lng, novo);
    }
  }

  const perfis = estado.kind === "ok" ? estado.perfis : [];
  const perfisFiltrados =
    tipoFiltro === "todos"
      ? perfis
      : perfis.filter((p) => p.tipo === tipoFiltro);

  return (
    <div className="flex flex-col px-5 pt-10 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1
            className="display gold-text"
            style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            Radar
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            Quem tá perto de você agora
          </p>
        </div>
        <Link
          href="/app/buscar"
          aria-label="Buscar por nome ou token"
          className="flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            color: "var(--gold-300)",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </Link>
      </div>

      {/* Aviso se invisível pros outros */}
      {!meuVisivel && (
        <div
          className="mb-4 rounded-xl p-3"
          style={{
            background: "rgba(217,138,114,0.08)",
            border: "1px solid rgba(217,138,114,0.3)",
            fontSize: 12,
            color: "var(--rose-400)",
            lineHeight: 1.5,
          }}
        >
          Você está <strong>invisível</strong> pros outros no radar. Pra
          aparecer, ative em{" "}
          <Link
            href="/app/perfil/ajustes"
            style={{ color: "var(--gold-300)", textDecoration: "underline" }}
          >
            Ajustes → Aparecer no radar
          </Link>
          .
        </div>
      )}

      {/* Estado: iniciando — CTA pra pedir localização */}
      {estado.kind === "iniciando" && !tinhaGeo && (
        <div
          className="rounded-2xl p-5 flex flex-col items-center text-center gap-3"
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ fontSize: 36 }}>📍</div>
          <div
            className="display"
            style={{ fontSize: 18, fontWeight: 500, color: "var(--text-0)" }}
          >
            Liga o radar
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-2)",
              maxWidth: 280,
              lineHeight: 1.5,
            }}
          >
            Pra ver quem tá próximo, preciso da sua localização. Ela fica
            salva e só é usada pra calcular distância — ninguém vê suas
            coordenadas exatas.
          </p>
          <button
            type="button"
            onClick={pedirLocalizacao}
            className="btn-gold mt-1"
            style={{ padding: "11px 22px" }}
          >
            Compartilhar localização
          </button>
        </div>
      )}

      {/* Estado: carregando geolocation */}
      {estado.kind === "carregando" && (
        <div
          className="rounded-2xl p-6 flex flex-col items-center text-center gap-2"
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ fontSize: 28 }}>📡</div>
          <div style={{ fontSize: 13, color: "var(--text-1)" }}>
            Pegando sua localização…
          </div>
        </div>
      )}

      {/* Estado: permissão negada */}
      {estado.kind === "permissao_negada" && (
        <div
          className="rounded-2xl p-5 flex flex-col items-center text-center gap-3"
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ fontSize: 36 }}>🚫</div>
          <div
            className="display"
            style={{ fontSize: 16, fontWeight: 500, color: "var(--text-0)" }}
          >
            Permissão de localização negada
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-2)",
              maxWidth: 300,
              lineHeight: 1.5,
            }}
          >
            Pra usar o radar, vai nas configurações do navegador,
            permite localização pro PrivateSocial, e tenta de novo.
          </p>
          <button
            type="button"
            onClick={pedirLocalizacao}
            className="btn-ghost mt-1"
            style={{ padding: "10px 18px" }}
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Estado: erro genérico */}
      {estado.kind === "erro" && (
        <div
          className="rounded-2xl p-5 flex flex-col items-center text-center gap-3"
          style={{
            background: "rgba(217,138,114,0.06)",
            border: "1px solid rgba(217,138,114,0.3)",
          }}
        >
          <div style={{ fontSize: 28 }}>⚠</div>
          <p
            style={{
              fontSize: 13,
              color: "var(--rose-400)",
              maxWidth: 300,
              lineHeight: 1.5,
            }}
          >
            {estado.mensagem}
          </p>
          <button
            type="button"
            onClick={pedirLocalizacao}
            className="btn-ghost mt-1"
            style={{ padding: "10px 18px" }}
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Estado: ok ou buscando — mostra filtros + lista */}
      {(estado.kind === "ok" || estado.kind === "buscando") && (
        <>
          {/* Filtros */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex gap-2 overflow-x-auto scroll">
              <FilterChip
                label="Todos"
                active={tipoFiltro === "todos"}
                onClick={() => setTipoFiltro("todos")}
              />
              <FilterChip
                label="Casais"
                active={tipoFiltro === "casal"}
                onClick={() => setTipoFiltro("casal")}
              />
              <FilterChip
                label="Mulheres"
                active={tipoFiltro === "mulher"}
                onClick={() => setTipoFiltro("mulher")}
              />
              <FilterChip
                label="Homens"
                active={tipoFiltro === "homem"}
                onClick={() => setTipoFiltro("homem")}
              />
            </div>

            <div className="flex items-center gap-2">
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                }}
              >
                Raio
              </span>
              {[10, 25, 50, 100, 250].map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => trocarRaio(km)}
                  className={raioKm === km ? "chip gold" : "chip"}
                  style={{
                    fontSize: 11,
                    padding: "5px 10px",
                    cursor: "pointer",
                  }}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          {(pending || estado.kind === "buscando") && (
            <div
              className="rounded-2xl p-5 text-center"
              style={{
                background: "var(--bg-1)",
                border: "1px solid var(--line)",
                fontSize: 13,
                color: "var(--text-2)",
              }}
            >
              Buscando perfis no raio de {raioKm} km…
            </div>
          )}

          {!pending &&
            estado.kind === "ok" &&
            perfisFiltrados.length === 0 && (
              <div
                className="rounded-2xl p-6 flex flex-col items-center text-center gap-2"
                style={{
                  background: "var(--bg-1)",
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ fontSize: 32 }}>👥</div>
                <div
                  className="display"
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: "var(--text-0)",
                  }}
                >
                  Ninguém aqui ainda
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-3)",
                    maxWidth: 280,
                    lineHeight: 1.5,
                  }}
                >
                  Nenhum perfil encontrado no raio de {raioKm} km. Aumenta
                  o raio ou tenta outro filtro.
                </p>
              </div>
            )}

          {!pending &&
            estado.kind === "ok" &&
            perfisFiltrados.length > 0 && (
              <div className="flex flex-col gap-2">
                {perfisFiltrados.map((p) => (
                  <RadarRow key={p.id} perfil={p} />
                ))}
              </div>
            )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "chip gold" : "chip"}
      style={{
        whiteSpace: "nowrap",
        flexShrink: 0,
        cursor: "pointer",
        background: active ? undefined : "transparent",
      }}
    >
      {label}
    </button>
  );
}

function RadarRow({ perfil }: { perfil: RadarPerfil }) {
  const distanciaLabel =
    perfil.distanciaKm < 1
      ? `${Math.round(perfil.distanciaKm * 1000)} m`
      : perfil.distanciaKm < 10
        ? `${perfil.distanciaKm.toFixed(1)} km`
        : `${Math.round(perfil.distanciaKm)} km`;

  return (
    <Link
      href={`/app/p/${perfil.id}`}
      className="flex items-center gap-3 p-3 rounded-2xl"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        textDecoration: "none",
      }}
    >
      <div
        className="relative overflow-hidden flex-shrink-0"
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "1px solid var(--gold-600)",
          background: "var(--bg-2)",
        }}
      >
        {perfil.capa ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={perfil.capa}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: "var(--gold-300)", fontSize: 18 }}
          >
            ♥
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div
            className="truncate"
            style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}
          >
            {perfil.nome}
          </div>
          {perfil.idades && (
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>
              {perfil.idades}
            </span>
          )}
          {perfil.vip && (
            <span
              style={{
                background: "var(--shine-gold)",
                color: "#1a0f05",
                fontSize: 8,
                fontWeight: 800,
                padding: "1px 5px",
                borderRadius: 4,
                letterSpacing: 0.5,
              }}
            >
              VIP
            </span>
          )}
        </div>
        <div
          className="truncate"
          style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}
        >
          {[perfil.cidade, tipoLabel(perfil.tipo)].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div className="flex flex-col items-end flex-shrink-0">
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--gold-300)",
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          {distanciaLabel}
        </span>
        <span style={{ color: "var(--text-3)", fontSize: 16, marginTop: 1 }}>
          ›
        </span>
      </div>
    </Link>
  );
}

function tipoLabel(t: "casal" | "homem" | "mulher" | null): string {
  if (t === "casal") return "Casal";
  if (t === "mulher") return "Mulher solo";
  if (t === "homem") return "Homem solo";
  return "";
}
