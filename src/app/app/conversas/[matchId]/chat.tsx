"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, markAsRead } from "./actions";
import {
  WatermarkOverlay,
  ContainedPhotoWithWatermark,
} from "@/components/watermarked-photo";
import { makeViewerToken } from "@/lib/watermark-token";

/* ====================================================================
 * Chat — client do /app/conversas/[matchId]
 *
 *  - Abre canal Realtime `chat:{matchId}` pra:
 *      · postgres_changes INSERT em mensagens (eco + recebidas)
 *      · presence → status online do outro user
 *  - Envia mensagem via server action + optimistic update
 *  - "Quebrar o gelo" com templates do design
 *  - Marca mensagens recebidas como lidas (RPC) ao abrir
 * ================================================================== */

export type MensagemRow = {
  id: string;
  conversa_id: string;
  de_id: string;
  texto: string | null;
  tipo: "texto" | "imagem" | "audio";
  anexo_url: string | null;
  /** Signed URL resolvida server-side; pra mensagens novas via Realtime
   *  o client gera sob demanda (ver resolveAnexo no chat). */
  anexoSrc?: string | null;
  lido: boolean;
  created_at: string;
};

export type ChatOutro = {
  id: string;
  nome: string;
  tipo: "casal" | "homem" | "mulher" | null;
  verificado: boolean;
  vip: boolean;
  ultimoAtivo: string | null;
  capa: string | null;
  idades: string;
};

type MensagemLocal = MensagemRow & { pending?: boolean; tempId?: string };

type Props = {
  meId: string;
  minhaCapa: string | null;
  conversaId: string;
  matchId: string;
  matchedAt: string;
  outro: ChatOutro;
  mensagensIniciais: MensagemRow[];
  compatScore: number | null;
};

const ICE_QUESTIONS = [
  "O que vocês procuram aqui?",
  "Primeira vez tentando?",
  "Preferem encontros em casa ou fora?",
  "Já frequentam eventos liberais?",
  "Qual o limite de vocês?",
];

// Considera online se ativo nos últimos 90s OU presence atual
const ONLINE_THRESHOLD_MS = 90 * 1000;

export function Chat({
  meId,
  minhaCapa,
  conversaId,
  matchId,
  matchedAt,
  outro,
  mensagensIniciais,
  compatScore,
}: Props) {
  const [mensagensRaw, setMensagensRaw] = useState<MensagemLocal[]>(
    mensagensIniciais,
  );
  // Wrapper de setMensagens que detecta REMOÇÕES suspeitas (mensagem que
  // some sem motivo). Loga warning explícito pro debug do bug 29/04 em
  // que mensagens sumiam após enviar.
  const mensagensRef = useRef(mensagensRaw);
  const setMensagens = useCallback(
    (
      updater:
        | MensagemLocal[]
        | ((prev: MensagemLocal[]) => MensagemLocal[]),
    ) => {
      setMensagensRaw((prev) => {
        const next =
          typeof updater === "function" ? updater(prev) : updater;

        // Detecta perdas: id que estava na lista anterior e sumiu sem
        // ter sido substituido por mensagem real (id === tempId — ex
        // troca de pending por real).
        if (next.length < prev.length) {
          const nextIds = new Set(next.map((m) => m.id));
          const lost = prev.filter((m) => !nextIds.has(m.id));
          if (lost.length > 0) {
            console.warn(
              "[chat] ⚠ mensagens removidas do state:",
              lost.map((m) => ({ id: m.id, tipo: m.tipo, pending: m.pending })),
              "\nstack:",
              new Error().stack?.split("\n").slice(2, 6).join("\n"),
            );
          }
        }

        mensagensRef.current = next;
        return next;
      });
    },
    [],
  );
  const mensagens = mensagensRaw;
  const [draft, setDraft] = useState("");
  const [showIce, setShowIce] = useState(mensagensIniciais.length === 0);
  const [outroOnline, setOutroOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Upload de imagem
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Gravação de áudio (mensagem de voz)
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const recordingCanceledRef = useRef(false);
  const recordingStartRef = useRef(0);
  // Modal fullscreen pra ver foto grande ao clicar
  const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null);
  // ultimoAtivo vem do server, mas atualizamos via polling
  const [outroUltimoAtivo, setOutroUltimoAtivo] = useState<string | null>(
    outro.ultimoAtivo,
  );
  // Tick força re-render a cada 30s pra relative time atualizar
  const [, setTick] = useState(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const scrollToBottom = useCallback((smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Scroll inicial + ao carregar mais mensagens
  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  // Marca como lidas ao abrir. Depois chama router.refresh() pro layout
  // re-fetchar a contagem e o badge do bottom nav zerar imediatamente.
  useEffect(() => {
    void markAsRead(conversaId).then(() => router.refresh());
  }, [conversaId, router]);

  // Heartbeat do user atual — mantém meu ultimo_ativo fresco enquanto eu
  // estou no chat. Sem isso, `mark_active()` só dispara ao navegar.
  useEffect(() => {
    const id = setInterval(() => {
      void supabase.rpc("mark_active");
    }, 60_000);
    return () => clearInterval(id);
  }, [supabase]);

  // Polling do ultimo_ativo do outro (a cada 45s). Barato (1 coluna,
  // 1 row). O "online agora" já vem via presence; isso cobre o caso
  // "visto há X min" não ficar congelado.
  useEffect(() => {
    const id = setInterval(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("ultimo_ativo")
        .eq("id", outro.id)
        .maybeSingle();
      if (data?.ultimo_ativo) {
        setOutroUltimoAtivo(data.ultimo_ativo as string);
      }
    }, 45_000);
    return () => clearInterval(id);
  }, [supabase, outro.id]);

  // Tick a cada 30s pra re-render e recalcular relative time
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  /* ---- Realtime: mensagens + presence --------------------
   *
   * Refactor 30/04: o listener AGORA SÓ TRATA mensagens DO OUTRO user.
   * Mensagens próprias são adicionadas/replaceadas inline pela
   * `enviar()` usando o retorno do server action. Isso elimina:
   *   - race entre echo e replace de pending
   *   - reconciliação frágil (matching por tipo+de_id+texto)
   *   - flickers de pending sumindo antes do echo chegar
   * ------------------------------------------------------- */
  useEffect(() => {
    const channel = supabase.channel(`chat:${matchId}`, {
      config: { presence: { key: meId } },
    });

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "mensagens",
        filter: `conversa_id=eq.${conversaId}`,
      },
      async (payload) => {
        const nova = payload.new as MensagemRow;

        // ECHO da própria mensagem: ignora — já foi adicionada inline
        // pelo client após o sendMessage retornar. Sem isso, o echo
        // poderia gerar duplicatas ou trocar o blob URL por signed
        // URL ainda não disponível na CDN.
        if (nova.de_id === meId) {
          return;
        }

        // Mensagem do outro user — resolve signed URL pra anexo
        let anexoSrc: string | null = null;
        if (nova.anexo_url) {
          try {
            const { data, error: signErr } = await supabase.storage
              .from("chat-media")
              .createSignedUrl(nova.anexo_url, 60 * 60);
            if (signErr) {
              console.error(
                "[chat] createSignedUrl falhou:",
                signErr,
                "path:",
                nova.anexo_url,
              );
            }
            anexoSrc = data?.signedUrl ?? null;
          } catch (e) {
            console.error("[chat] erro ao gerar signed URL:", e);
          }
        }

        setMensagens((atual) => {
          // Dedup defensivo (Realtime pode entregar duplicado em rede ruim)
          if (atual.some((m) => m.id === nova.id)) return atual;
          return [...atual, { ...nova, anexoSrc }];
        });

        // Marca como lida e força re-fetch do badge no bottom nav
        void markAsRead(conversaId).then(() => router.refresh());

        requestAnimationFrame(() => scrollToBottom(true));
      },
    );

    // Presence — quem está online no canal
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ user: string }>();
      const outrosOnline = Object.keys(state).some((key) => key !== meId);
      setOutroOnline(outrosOnline);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user: meId, at: new Date().toISOString() });
      }
    });

    return () => {
      void channel.unsubscribe();
    };
  }, [supabase, conversaId, matchId, meId, scrollToBottom]);

  /* ---- Compress + upload de imagem ---------------------- */

  /**
   * Comprime imagem pra max 1200px JPEG 85%.
   *
   * Robustez (28/04/26): user reportou foto "não envia" sem erro claro.
   * Causas possíveis:
   *  - HEIC do iPhone: Chrome/Android não decodifica → onload nunca dispara
   *  - Foto gigante (8000×6000): drawImage trava ou estoura memória
   *  - Imagem corrompida: decode falha silenciosamente
   *
   * Mitigações:
   *  - Timeout de 8s no decode (rejeita se onload não disparar)
   *  - Detecta HEIC por extensão e rejeita com mensagem clara
   *  - Retorna o file original se já tiver < 500KB (skip compression)
   *  - Try/catch em cada etapa (decode, drawImage, toBlob) com error
   *    específico, não genérico "encode_failed"
   */
  async function compressImage(file: File): Promise<Blob> {
    // 1. Heurística: foto pequena já vai sem comprimir (economiza CPU
    //    e evita re-encode em casos onde a imagem já é JPEG enxuto).
    if (file.size < 500_000) {
      return file;
    }

    // 2. Detecta HEIC/HEIF — formato Apple que Android não decodifica.
    //    iOS Safari converte automaticamente, então só pega quando o
    //    arquivo veio doutra fonte (download, AirDrop, etc.).
    const nome = file.name.toLowerCase();
    if (
      nome.endsWith(".heic") ||
      nome.endsWith(".heif") ||
      file.type === "image/heic" ||
      file.type === "image/heif"
    ) {
      throw new Error(
        "Formato HEIC não suportado. No iPhone, vá em Câmera > Formatos > Mais Compatível, ou converta a foto pra JPG antes de enviar.",
      );
    }

    // 3. Decode com timeout (8s) pra não travar em foto corrompida
    const objectUrl = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        const timer = window.setTimeout(() => {
          reject(new Error("decode_timeout"));
        }, 8000);
        el.onload = () => {
          window.clearTimeout(timer);
          resolve(el);
        };
        el.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error("decode_failed"));
        };
        el.src = objectUrl;
      });
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      const code = err instanceof Error ? err.message : "decode_failed";
      if (code === "decode_timeout") {
        throw new Error(
          "Não conseguimos abrir essa foto (demorou demais). Tenta uma foto menor ou em outro formato.",
        );
      }
      throw new Error(
        "Foto inválida ou corrompida. Tenta outra imagem.",
      );
    }

    try {
      const max = 1200;
      const ratio = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error(
          "Seu navegador não suporta processamento de imagem. Tenta em outro navegador.",
        );
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) {
              resolve(b);
            } else {
              reject(
                new Error(
                  "Falha ao processar a foto. Tenta uma imagem menor.",
                ),
              );
            }
          },
          "image/jpeg",
          0.85,
        );
      });
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      // Repassa erro com mensagem amigável
      if (err instanceof Error) throw err;
      throw new Error("Falha ao processar a foto.");
    }
  }

  function abrirPicker() {
    fileInputRef.current?.click();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione uma imagem.");
      return;
    }
    setError(null);
    setPickedFile(file);
    // Preview imediato com object URL local
    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
    // Reseta input pra permitir escolher mesmo arquivo de novo
    e.target.value = "";
  }

  function cancelarAnexo() {
    setPickedFile(null);
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setPreviewSrc(null);
  }

  /* ---- Gravação de áudio (mensagem de voz) -------------- */

  // Limite de 2min por áudio — mais que isso é melhor agendar uma call
  const AUDIO_MAX_MS = 2 * 60 * 1000;

  // Detecta o melhor mimeType suportado pelo browser. iOS Safari só
  // grava em mp4/aac, Chrome/Firefox preferem webm/opus.
  function pickAudioMimeType(): { mime: string; ext: string } {
    if (typeof MediaRecorder === "undefined") {
      return { mime: "", ext: "webm" };
    }
    const candidates: Array<{ mime: string; ext: string }> = [
      { mime: "audio/webm;codecs=opus", ext: "webm" },
      { mime: "audio/webm", ext: "webm" },
      { mime: "audio/mp4", ext: "m4a" },
      { mime: "audio/ogg;codecs=opus", ext: "ogg" },
      { mime: "audio/mpeg", ext: "mp3" },
    ];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    }
    return { mime: "", ext: "webm" };
  }

  function pararTimer() {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function liberarMic() {
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }

  async function iniciarGravacao() {
    if (recording || uploading) return;
    setError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Seu navegador não suporta gravação de áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = stream;
      const { mime } = pickAudioMimeType();
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      audioChunksRef.current = [];
      recordingCanceledRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        pararTimer();
        const wasCanceled = recordingCanceledRef.current;
        const chunks = audioChunksRef.current;
        const duracaoMs = Date.now() - recordingStartRef.current;
        liberarMic();
        setRecording(false);
        setRecordingMs(0);

        if (wasCanceled || chunks.length === 0) return;
        if (duracaoMs < 800) {
          setError("Áudio muito curto. Segura o botão por mais tempo.");
          return;
        }

        const blob = new Blob(chunks, {
          type: mime || "audio/webm",
        });
        await uploadEEnviarAudio(blob, duracaoMs);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      setRecording(true);
      setRecordingMs(0);

      recordingTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartRef.current;
        setRecordingMs(elapsed);
        if (elapsed >= AUDIO_MAX_MS) {
          pararEEnviarGravacao();
        }
      }, 200);
    } catch (e) {
      console.error("[chat] erro ao iniciar gravação:", e);
      setError(
        "Não conseguimos acessar o microfone. Verifica as permissões do navegador.",
      );
      liberarMic();
      setRecording(false);
    }
  }

  function pararEEnviarGravacao() {
    if (!mediaRecorderRef.current || !recording) return;
    recordingCanceledRef.current = false;
    try {
      mediaRecorderRef.current.stop();
    } catch (e) {
      console.error("[chat] erro ao parar gravação:", e);
    }
  }

  function cancelarGravacao() {
    if (!mediaRecorderRef.current) return;
    recordingCanceledRef.current = true;
    try {
      mediaRecorderRef.current.stop();
    } catch (e) {
      console.error("[chat] erro ao cancelar gravação:", e);
      pararTimer();
      liberarMic();
      setRecording(false);
      setRecordingMs(0);
    }
  }

  // Garante que mic é liberado se o componente desmontar gravando
  useEffect(() => {
    return () => {
      pararTimer();
      liberarMic();
    };
  }, []);

  async function uploadEEnviarAudio(blob: Blob, duracaoMs: number) {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const agora = new Date().toISOString();
    const objectUrl = URL.createObjectURL(blob);

    const pending: MensagemLocal = {
      id: tempId,
      tempId,
      conversa_id: conversaId,
      de_id: meId,
      texto: null,
      tipo: "audio",
      anexo_url: null,
      anexoSrc: objectUrl,
      lido: false,
      created_at: agora,
      pending: true,
    };
    setMensagens((atual) => [...atual, pending]);
    requestAnimationFrame(() => scrollToBottom(true));

    startTransition(async () => {
      let anexoPath: string | null = null;
      try {
        setUploading(true);
        const ext = blob.type.includes("mp4")
          ? "m4a"
          : blob.type.includes("mpeg")
            ? "mp3"
            : blob.type.includes("ogg")
              ? "ogg"
              : "webm";
        const path = `${meId}/${conversaId}/${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(path, blob, {
            contentType: blob.type || "audio/webm",
            upsert: false,
          });
        if (upErr) {
          throw new Error(`Falha no upload do áudio: ${upErr.message}`);
        }
        anexoPath = path;
      } catch (e) {
        setUploading(false);
        const msg = e instanceof Error ? e.message : "Falha no upload do áudio.";
        console.error("[chat] upload áudio falhou:", e);
        setError(msg);
        setMensagens((atual) => atual.filter((m) => m.tempId !== tempId));
        URL.revokeObjectURL(objectUrl);
        return;
      } finally {
        setUploading(false);
      }

      if (!anexoPath) return;
      const result = await sendMessage(conversaId, "", anexoPath, "audio");
      if ("error" in result) {
        console.error("[chat] sendMessage áudio falhou:", result.error, {
          conversaId,
          path: anexoPath,
        });
        setError(result.error);
        setMensagens((atual) => atual.filter((m) => m.tempId !== tempId));
        URL.revokeObjectURL(objectUrl);
        return;
      }

      // SUCESSO: substitui pending inline com a row real, mantém
      // o blob URL local + tempId pra key estável. Echo Realtime
      // pra essa msg será ignorado pelo listener.
      const real = result.mensagem;
      setMensagens((atual) =>
        atual.map((m) =>
          m.tempId === tempId
            ? {
                id: real.id,
                conversa_id: real.conversa_id,
                de_id: real.de_id,
                texto: real.texto,
                tipo: real.tipo,
                anexo_url: real.anexo_url,
                anexoSrc: m.anexoSrc, // mantém objectUrl local
                lido: real.lido,
                created_at: real.created_at,
                tempId: m.tempId,
              }
            : m,
        ),
      );
      void duracaoMs; // reservado pra futuro: salvar em metadata
    });
  }

  /* ---- Envio de mensagem -------------------------------- */
  function enviar(texto: string) {
    const limpo = texto.trim();
    const temAnexo = !!pickedFile;
    if (!limpo && !temAnexo) return;
    setError(null);
    setShowIce(false);

    const tempId = `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const agora = new Date().toISOString();

    // Otimista: adiciona pending na lista
    const pending: MensagemLocal = {
      id: tempId,
      tempId,
      conversa_id: conversaId,
      de_id: meId,
      texto: limpo || null,
      tipo: temAnexo ? "imagem" : "texto",
      anexo_url: null, // resolvido após upload
      anexoSrc: previewSrc, // mostra preview local enquanto sobe
      lido: false,
      created_at: agora,
      pending: true,
    };
    console.log("[chat] criando pending:", {
      tempId,
      texto: pending.texto,
      tipo: pending.tipo,
      temAnexoLocal: temAnexo,
    });
    setMensagens((atual) => [...atual, pending]);
    setDraft("");
    requestAnimationFrame(() => scrollToBottom(true));

    // Captura o arquivo + preview ANTES de limpar o estado
    const fileToUpload = pickedFile;
    const previewToRevoke = previewSrc;
    // Limpa estado do input
    setPickedFile(null);
    setPreviewSrc(null);

    startTransition(async () => {
      let anexoPath: string | null = null;
      if (fileToUpload) {
        try {
          setUploading(true);
          let blob: Blob;
          try {
            blob = await compressImage(fileToUpload);
          } catch (compressErr) {
            // Erro do compressImage já vem com mensagem amigável
            throw compressErr;
          }

          // Sanity check: ainda tem tamanho razoável depois de comprimir?
          if (blob.size > 8_000_000) {
            throw new Error(
              "Foto muito grande mesmo depois de comprimir. Tenta uma menor.",
            );
          }

          const ext = "jpg";
          const path = `${meId}/${conversaId}/${Date.now()}-${Math.random()
            .toString(16)
            .slice(2)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("chat-media")
            .upload(path, blob, {
              contentType: "image/jpeg",
              upsert: false,
            });
          if (upErr) {
            // Mensagens mais claras pros erros mais comuns
            const msg = upErr.message ?? "";
            if (
              msg.includes("row-level security") ||
              msg.includes("new row violates")
            ) {
              throw new Error(
                "Sessão expirada. Saia e entre de novo no app pra restaurar o acesso.",
              );
            }
            if (msg.toLowerCase().includes("payload") || msg.includes("413")) {
              throw new Error(
                "Foto muito grande pro servidor. Tenta uma menor.",
              );
            }
            throw new Error(`Falha no upload: ${msg || "erro desconhecido"}`);
          }
          anexoPath = path;
        } catch (e) {
          setUploading(false);
          const msg =
            e instanceof Error ? e.message : "Falha no upload da foto.";
          // Log explícito pra debug — usuário pode mandar print do console
          console.error("[chat] upload falhou:", e);
          setError(msg);
          setMensagens((atual) => atual.filter((m) => m.tempId !== tempId));
          if (previewToRevoke) URL.revokeObjectURL(previewToRevoke);
          return;
        } finally {
          setUploading(false);
        }
      }

      const result = await sendMessage(conversaId, limpo, anexoPath);
      if ("error" in result) {
        console.error("[chat] sendMessage falhou:", result.error, {
          conversaId,
          tipo: anexoPath ? "imagem" : "texto",
          textoLen: limpo.length,
        });
        setError(result.error);
        setMensagens((atual) => atual.filter((m) => m.tempId !== tempId));
        // Erro: revoga o blob URL pq não vamos mais precisar
        if (previewToRevoke) URL.revokeObjectURL(previewToRevoke);
        return;
      }

      // SUCESSO: substitui o pending inline pelo registro real do
      // servidor — preserva o blob URL local pra anexoSrc (signed URL
      // não fica disponível instantaneamente na CDN). A row real tem
      // id de verdade + lido + created_at corretos. Echo do Realtime
      // pra essa mesma msg vai ser ignorado pelo listener (de_id===meId).
      // Mantém tempId pra key estável no React (evita unmount/remount
      // do bubble que causa flicker da imagem).
      const real = result.mensagem;
      setMensagens((atual) =>
        atual.map((m) =>
          m.tempId === tempId
            ? {
                id: real.id,
                conversa_id: real.conversa_id,
                de_id: real.de_id,
                texto: real.texto,
                tipo: real.tipo,
                anexo_url: real.anexo_url,
                anexoSrc: m.anexoSrc, // mantém blob URL local
                lido: real.lido,
                created_at: real.created_at,
                tempId: m.tempId,
                // pending: undefined → vira false (não mostra "..." nem opacidade)
              }
            : m,
        ),
      );
      // NÃO revogar previewToRevoke — fica como fallback até refresh
    });
  }

  const statusOnlineReal =
    outroOnline ||
    (outroUltimoAtivo &&
      Date.now() - new Date(outroUltimoAtivo).getTime() < ONLINE_THRESHOLD_MS);
  const statusLabel = statusOnlineReal
    ? "online agora"
    : outroUltimoAtivo
      ? `visto ${relativeTime(outroUltimoAtivo)}`
      : "offline";

  const matchRel = useMemo(() => matchAgeText(matchedAt), [matchedAt]);

  // Token de rastreamento — aplicado em fotos do chat pra que se uma
  // imagem vazar (print, screen capture), dá pra ver quem era o viewer.
  // Determinístico do user.id, ok client-side.
  const meuToken = useMemo(() => makeViewerToken(meId), [meId]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 90px)" }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-2.5 px-3"
        style={{
          paddingTop: 18,
          paddingBottom: 10,
          borderBottom: "1px solid var(--line)",
          background: "rgba(10,7,6,0.92)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Link
          href="/app/conversas"
          aria-label="Voltar"
          className="flex items-center justify-center"
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            color: "var(--text-1)",
            textDecoration: "none",
            fontSize: 20,
          }}
        >
          ‹
        </Link>
        <Link
          href={`/app/p/${outro.id}`}
          className="relative flex-shrink-0 overflow-hidden"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "1px solid var(--gold-600)",
            background: "var(--bg-2)",
            textDecoration: "none",
          }}
          aria-label={`Ver perfil de ${outro.nome}`}
        >
          {outro.capa ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={outro.capa}
              alt=""
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: "var(--gold-300)", fontSize: 16 }}
            >
              ♥
            </div>
          )}
        </Link>
        <Link
          href={`/app/p/${outro.id}`}
          className="flex-1 min-w-0"
          style={{ textDecoration: "none" }}
        >
          <div
            className="flex items-center gap-1.5 truncate"
            style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}
          >
            <span className="truncate">{outro.nome}</span>
            {outro.verificado && (
              <span
                style={{
                  color: "var(--gold-300)",
                  fontSize: 10,
                }}
                title="Verificado"
              >
                ✓
              </span>
            )}
            {outro.vip && (
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
            className="flex items-center gap-1.5 truncate"
            style={{
              fontSize: 11,
              color: statusOnlineReal ? "var(--gold-300)" : "var(--text-3)",
              marginTop: 1,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: statusOnlineReal
                  ? "var(--gold-300)"
                  : "var(--text-3)",
                flexShrink: 0,
              }}
            />
            <span suppressHydrationWarning>{statusLabel}</span>
          </div>
        </Link>
      </header>

      <div
        className="mx-3.5 mt-3 flex items-center gap-2.5 rounded-xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(212,175,110,0.10), rgba(212,175,110,0.02))",
          border: "1px solid var(--line)",
          padding: "10px 12px",
          fontSize: 11,
          color: "var(--text-2)",
          lineHeight: 1.4,
        }}
      >
        <span style={{ color: "var(--gold-300)" }}>✨</span>
        <span className="flex-1" suppressHydrationWarning>
          Match {matchRel}
          {compatScore !== null && (
            <>
              {" · "}Compatibilidade{" "}
              <b style={{ color: "var(--gold-300)" }}>{compatScore}%</b>
            </>
          )}
        </span>
      </div>

      <div
        ref={listRef}
        className="scroll flex-1 overflow-y-auto flex flex-col gap-2"
        style={{ padding: "14px 14px 4px" }}
      >
        {mensagens.length === 0 && (
          <div
            className="flex flex-col items-center justify-center text-center flex-1 gap-2"
            style={{ color: "var(--text-2)", padding: 24 }}
          >
            <div
              className="display"
              style={{ fontSize: 22, color: "var(--text-1)" }}
            >
              Diga oi
            </div>
            <div style={{ fontSize: 12, maxWidth: 260, lineHeight: 1.5 }}>
              Abre com uma pergunta boa. Os templates abaixo ajudam.
            </div>
          </div>
        )}
        {mensagens.map((m) => (
          <MensagemBubble
            // tempId persiste após replace pra key não mudar (evita
            // unmount/remount do bubble da imagem ao trocar pending
            // por real, que era visto como "foto sumindo").
            key={m.tempId ?? m.id}
            m={m}
            meId={meId}
            meuToken={meuToken}
            onAbrirFoto={(src) => setFullscreenSrc(src)}
          />
        ))}
      </div>

      {showIce && (
        <div
          className="mx-3.5 mb-2 rounded-xl"
          style={{
            background:
              "linear-gradient(160deg, rgba(212,175,110,0.15), rgba(212,175,110,0.03))",
            border: "1px solid var(--line-strong)",
            padding: 14,
          }}
        >
          <div
            className="flex items-center gap-1.5 mb-2"
            style={{
              fontSize: 11,
              color: "var(--gold-300)",
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            <span>✨</span>
            Quebrar o gelo
          </div>
          <div className="flex flex-col gap-1.5">
            {ICE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  enviar(q);
                  setShowIce(false);
                }}
                style={{
                  textAlign: "left",
                  padding: "9px 12px",
                  fontSize: 13,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  color: "var(--text-1)",
                  cursor: "pointer",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mx-3.5 mb-2 rounded-xl p-3"
          style={{
            background: "rgba(217, 138, 114, 0.08)",
            border: "1px solid rgba(217, 138, 114, 0.3)",
            color: "var(--rose-400)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <div
        className="flex items-center gap-2 relative"
        style={{
          padding: "8px 14px 14px",
          borderTop: "1px solid var(--line)",
          background: "var(--bg-0)",
        }}
      >
        <button
          type="button"
          onClick={() => setShowIce((v) => !v)}
          aria-label={showIce ? "Fechar quebrar o gelo" : "Quebrar o gelo"}
          title="Quebrar o gelo"
          className="relative flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: showIce
              ? "2px solid var(--gold-300)"
              : "1px solid var(--gold-600)",
            background: "var(--bg-2)",
            cursor: "pointer",
            padding: 0,
            boxShadow: showIce
              ? "0 0 0 3px rgba(212,175,110,0.25), 0 4px 14px rgba(212,175,110,0.35)"
              : "none",
            transition: "box-shadow 0.2s, border-color 0.2s",
          }}
        >
          {minhaCapa ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={minhaCapa}
              alt="Você"
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: "var(--gold-300)", fontSize: 16 }}
            >
              ✨
            </span>
          )}
        </button>
        <div
          className="flex-1 flex items-center gap-1.5"
          style={{
            background: recording ? "rgba(217,138,114,0.08)" : "var(--bg-1)",
            border: recording
              ? "1px solid var(--rose-500)"
              : "1px solid var(--line)",
            borderRadius: 22,
            padding: previewSrc ? "8px 8px 8px 8px" : "6px 14px",
            flexDirection: previewSrc ? "column" : "row",
            alignItems: previewSrc ? "stretch" : "center",
            transition: "background 0.2s, border-color 0.2s",
          }}
        >
          {/* Preview da foto antes de enviar */}
          {previewSrc && (
            <div
              className="relative"
              style={{
                width: 80,
                height: 80,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid var(--gold-600)",
                marginBottom: 6,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc}
                alt="Anexo"
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: "cover" }}
              />
              <button
                type="button"
                onClick={cancelarAnexo}
                aria-label="Remover foto"
                className="absolute"
                style={{
                  top: 4,
                  right: 4,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.7)",
                  border: "none",
                  color: "#fff",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5 w-full">
            {recording ? (
              // Durante gravação, o input vira um indicador "Gravando 0:23"
              // com bolinha pulsando e ondinhas — substitui o campo de texto
              // pra ficar BEM óbvio que tá gravando.
              <div
                className="flex items-center gap-2 w-full"
                style={{ padding: "6px 4px" }}
                aria-live="polite"
              >
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "var(--rose-500)",
                    boxShadow: "0 0 10px rgba(255,76,107,0.7)",
                    animation: "rec-pulse 1s ease-in-out infinite",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--rose-400)",
                    fontWeight: 700,
                    letterSpacing: 0.3,
                  }}
                >
                  Gravando
                </span>

                {/* Ondinhas animadas — confirmação visual de áudio */}
                <span
                  className="flex items-end gap-0.5 flex-1"
                  aria-hidden
                  style={{ height: 18, justifyContent: "flex-start" }}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 3,
                        background: "var(--gold-300)",
                        borderRadius: 1.5,
                        animation: `rec-wave 0.9s ease-in-out infinite`,
                        animationDelay: `${i * 0.07}s`,
                      }}
                    />
                  ))}
                </span>

                <span
                  className="mono"
                  style={{
                    fontSize: 13,
                    color: "var(--gold-300)",
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    flexShrink: 0,
                  }}
                >
                  {formatDuration(recordingMs)}
                </span>
              </div>
            ) : (
              <>
                {/* Botão clipe */}
                <button
                  type="button"
                  onClick={abrirPicker}
                  disabled={uploading || !!pickedFile}
                  aria-label="Anexar foto"
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "transparent",
                    border: "none",
                    cursor:
                      uploading || pickedFile ? "not-allowed" : "pointer",
                    color: pickedFile ? "var(--gold-300)" : "var(--text-2)",
                    fontSize: 18,
                    padding: 0,
                    opacity: uploading ? 0.5 : 1,
                  }}
                >
                  📎
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFilePicked}
                  style={{ display: "none" }}
                  aria-hidden
                />
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar(draft);
                    }
                  }}
                  placeholder={
                    pickedFile
                      ? "Adicione um comentário…"
                      : "Escreva uma mensagem…"
                  }
                  maxLength={1000}
                  disabled={uploading}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--text-0)",
                    fontSize: 14,
                    fontFamily: "var(--font-ui)",
                    padding: "6px 0",
                  }}
                />
              </>
            )}
          </div>
        </div>
        {recording ? (
          // Durante gravação: 2 botões — cancelar (X vermelho) e
          // enviar (avião dourado). Substituem mic + send até parar.
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => cancelarGravacao()}
              aria-label="Cancelar gravação"
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(217,138,114,0.15)",
                border: "1px solid var(--rose-500)",
                cursor: "pointer",
                color: "var(--rose-400)",
                fontSize: 18,
              }}
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => pararEEnviarGravacao()}
              aria-label="Enviar áudio"
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "var(--shine-gold)",
                border: "none",
                cursor: "pointer",
                color: "#1a0f05",
                fontSize: 16,
              }}
            >
              ➤
            </button>
          </div>
        ) : (draft.trim() || pickedFile) ? (
          <button
            type="button"
            onClick={() => enviar(draft)}
            disabled={uploading}
            aria-label={uploading ? "Enviando..." : "Enviar"}
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: !uploading
                ? "var(--shine-gold)"
                : "rgba(255,255,255,0.06)",
              border: "none",
              cursor: !uploading ? "pointer" : "not-allowed",
              color: !uploading ? "#1a0f05" : "var(--text-3)",
              fontSize: 16,
            }}
          >
            {uploading ? "…" : "➤"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void iniciarGravacao()}
            disabled={uploading}
            aria-label="Gravar áudio"
            title="Toque pra começar a gravar"
            onContextMenu={(e) => e.preventDefault()}
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "none",
              cursor: uploading ? "not-allowed" : "pointer",
              color: "var(--gold-300)",
              fontSize: 18,
              userSelect: "none",
              WebkitTouchCallout: "none",
            }}
          >
            🎤
          </button>
        )}
      </div>

      {/* Animações usadas pelo indicador "Gravando" dentro do input */}
      <style jsx global>{`
        @keyframes rec-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes rec-wave {
          0%, 100% { height: 4px; opacity: 0.45; }
          50% { height: 16px; opacity: 1; }
        }
      `}</style>

      {/* Modal fullscreen pra ver foto em tamanho completo ao clicar */}
      {fullscreenSrc && (
        <FotoFullscreen
          src={fullscreenSrc}
          watermarkLabel={meuToken}
          onClose={() => setFullscreenSrc(null)}
        />
      )}
    </div>
  );
}

function FotoFullscreen({
  src,
  watermarkLabel,
  onClose,
}: {
  src: string;
  watermarkLabel: string;
  onClose: () => void;
}) {
  // Fecha com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Trava scroll do body enquanto modal aberto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "zoom-out",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "#fff",
          fontSize: 20,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // z-index alto pra garantir que fica acima do wrapper da foto
          // (sibling no DOM, sem isso o wrapper pintava por cima e o
          // X virava clickless)
          zIndex: 2,
        }}
      >
        ×
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          height: "100vh",
          cursor: "default",
          zIndex: 1,
        }}
      >
        <ContainedPhotoWithWatermark
          src={src}
          alt="Foto"
          label={watermarkLabel}
          intensity="subtle"
          style={{
            position: "absolute",
            inset: 0,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Player de áudio customizado pra bubble do chat. Não usa <audio
 * controls> nativo (fica feio e inconsistente entre browsers) —
 * controla um <audio> escondido via React state e renderiza UI
 * própria com play/pause + barras de progresso estilo waveform.
 */
function AudioPlayer({ src, mine }: { src: string; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      void a.play().catch(() => setPlaying(false));
    }
  }

  function onSeek(pct: number) {
    const a = audioRef.current;
    if (!a || !a.duration || isNaN(a.duration)) return;
    a.currentTime = a.duration * pct;
  }

  const progress = duration > 0 ? currentTime / duration : 0;
  const showTime = playing || currentTime > 0 ? currentTime : duration;

  // Barras de pseudo-waveform — alturas determinísticas (mesmo áudio,
  // mesmo padrão visual). Usa hash do src pra variar entre msgs.
  const NUM_BARS = 28;
  const bars = useRef<number[]>([]);
  if (bars.current.length === 0) {
    let seed = 0;
    for (let i = 0; i < src.length; i++) seed = (seed * 31 + src.charCodeAt(i)) & 0xffff;
    for (let i = 0; i < NUM_BARS; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      bars.current.push(0.3 + (seed % 100) / 140); // 0.3-1.0
    }
  }

  const accentFilled = mine ? "#1a0f05" : "var(--gold-300)";
  const accentEmpty = mine ? "rgba(26,15,5,0.25)" : "rgba(212,175,110,0.25)";

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pausar" : "Tocar"}
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: mine ? "rgba(26,15,5,0.2)" : "var(--gold-500)",
          border: "none",
          cursor: "pointer",
          color: mine ? "#1a0f05" : "#1a0f05",
          fontSize: 13,
          padding: 0,
        }}
      >
        {playing ? "❚❚" : "▶"}
      </button>

      {/* Waveform clicável pra dar seek */}
      <button
        type="button"
        aria-label="Avançar áudio"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          onSeek(Math.max(0, Math.min(1, pct)));
        }}
        className="flex-1 flex items-center gap-0.5"
        style={{
          height: 26,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {bars.current.map((h, i) => {
          const filled = i / NUM_BARS < progress;
          return (
            <span
              key={i}
              style={{
                flex: 1,
                height: `${Math.round(h * 100)}%`,
                background: filled ? accentFilled : accentEmpty,
                borderRadius: 2,
                transition: "background 0.15s",
                minWidth: 2,
              }}
            />
          );
        })}
      </button>

      <span
        className="mono"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: mine ? "rgba(26,15,5,0.7)" : "var(--text-2)",
          minWidth: 32,
          textAlign: "right",
        }}
      >
        {formatDuration(showTime * 1000)}
      </span>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ display: "none" }}
      />
    </div>
  );
}

function MensagemBubble({
  m,
  meId,
  meuToken,
  onAbrirFoto,
}: {
  m: MensagemLocal;
  meId: string;
  meuToken: string;
  onAbrirFoto: (src: string) => void;
}) {
  const mine = m.de_id === meId;
  const temImagem = m.tipo === "imagem" && !!m.anexoSrc;
  const temAudio = m.tipo === "audio" && !!m.anexoSrc;
  // Bubble com tipo imagem/áudio mas SEM anexoSrc resolvido —
  // pode ser pending sem preview (raro) OU realtime que não conseguiu
  // gerar signed URL. Em qualquer caso, mostra placeholder em vez de
  // cair no fall-through (bubble vazio).
  const imagemPendente = m.tipo === "imagem" && !m.anexoSrc;
  const audioPendente = m.tipo === "audio" && !m.anexoSrc;
  const temTexto = !!m.texto;


  if (temAudio) {
    return (
      <div
        className={mine ? "self-end" : "self-start"}
        style={{
          maxWidth: 280,
          minWidth: 220,
          background: mine ? "var(--shine-gold)" : "var(--bg-2)",
          color: mine ? "#1a0f05" : "var(--text-0)",
          padding: "10px 12px 8px",
          borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          border: mine ? "none" : "1px solid var(--line)",
          opacity: m.pending ? 0.85 : 1,
        }}
      >
        <AudioPlayer src={m.anexoSrc!} mine={mine} />
        <div
          className="flex items-center justify-end gap-1"
          style={{
            fontSize: 9,
            marginTop: 4,
            color: mine ? "rgba(26,15,5,0.6)" : "var(--text-3)",
          }}
        >
          <ClientTime iso={m.created_at} />
          {mine && (
            <span
              aria-label={
                m.lido ? "Lida" : m.pending ? "Enviando" : "Enviada"
              }
            >
              {m.pending ? "…" : m.lido ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (audioPendente) {
    // Áudio sem anexoSrc — pode ser pending (uploading) ou erro de
    // signed URL. Mostra placeholder claro em qualquer caso.
    return (
      <div
        className={mine ? "self-end" : "self-start"}
        style={{
          maxWidth: 280,
          background: "var(--bg-2)",
          color: "var(--text-2)",
          borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          border: "1px dashed var(--line-strong)",
          padding: "12px 14px",
          fontSize: 12,
        }}
      >
        🎤 {m.pending ? "Enviando áudio..." : "Áudio indisponível"}
      </div>
    );
  }

  if (imagemPendente) {
    return (
      <div
        className={mine ? "self-end" : "self-start"}
        style={{
          width: 220,
          flexShrink: 0,
          background: "var(--bg-2)",
          color: "var(--text-2)",
          borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          border: "2px dashed var(--gold-600)",
          padding: "16px 14px",
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        <div style={{ fontSize: 18, marginBottom: 4 }}>📷</div>
        <div style={{ fontWeight: 600, color: "var(--text-1)" }}>
          {m.pending ? "Enviando foto..." : "Foto indisponível"}
        </div>
        {!m.pending && (
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-3)" }}>
            Tenta dar refresh na conversa. Se persistir, sai e entra de
            novo no app.
          </div>
        )}
        <div
          className="flex items-center justify-end gap-1"
          style={{
            fontSize: 9,
            marginTop: 6,
            color: "var(--text-3)",
          }}
        >
          <ClientTime iso={m.created_at} />
          {mine && (
            <span aria-label={m.lido ? "Lida" : "Enviada"}>
              {m.lido ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Bubble com imagem — tamanho uniforme (220x275 fixo)
  // pra ficar bonita e padronizada no chat.
  //
  // BUG fix 29/04 noite: antes usávamos aspectRatio:4/5 + width:100%
  // mas como a img é absolute, não contribui pro layout. Em flex
  // column com self-end/start, bubble encolhia pra 0 e ficava
  // INVISÍVEL. Agora width/height fixos garantem dimensões sempre.
  if (temImagem && m.anexoSrc) {
    return (
      <div
        className={mine ? "self-end" : "self-start"}
        style={{
          // Dimensões fixas + flexShrink:0 pra garantir que o bubble
          // apareça em flex column. Sem isso a img position:absolute
          // não estabelecia altura e o bubble colapsava pra 0px (bug
          // 29/04 — fotos invisíveis no chat).
          width: 220,
          flexShrink: 0,
          background: mine ? "var(--shine-gold)" : "var(--bg-2)",
          color: mine ? "#1a0f05" : "var(--text-0)",
          borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          // Borda dourada nas fotos — Admin quis manter o destaque
          // depois de ver no debug. Ficou bonito e marca bem o conteúdo.
          border: "2px solid var(--gold-500)",
          boxShadow: "0 4px 14px rgba(212,175,110,0.25)",
          opacity: m.pending ? 0.85 : 1,
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => onAbrirFoto(m.anexoSrc!)}
          aria-label="Ver foto em tela cheia"
          style={{
            display: "block",
            width: 220,
            height: 275,
            padding: 0,
            border: "none",
            background: "#000",
            cursor: "pointer",
            lineHeight: 0,
            position: "relative",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.anexoSrc}
            alt="Foto enviada"
            className="no-save absolute inset-0"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              userSelect: "none",
              WebkitTouchCallout: "none",
            }}
            draggable={false}
            decoding="async"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            onError={(e) => {
              // Loga mas NÃO esconde a img — manter o background preto
              // do button + borda dourada do bubble visível. Esconder
              // estraga o layout e dá impressão que a foto sumiu.
              console.error(
                "[chat] img onError — URL expirou ou blob corrompido:",
                m.anexoSrc,
              );
              const img = e.target as HTMLImageElement;
              img.style.opacity = "0";
            }}
          />
          {/* Watermark TC do viewer — print/leak rastreável */}
          <WatermarkOverlay label={meuToken} intensity="subtle" />
        </button>
        {temTexto && (
          <div
            style={{
              padding: "8px 12px 0",
              fontSize: 14,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {m.texto}
          </div>
        )}
        <div
          className="flex items-center justify-end gap-1"
          style={{
            fontSize: 9,
            padding: temTexto ? "4px 12px 8px" : "6px 12px 8px",
            color: mine ? "rgba(26,15,5,0.6)" : "var(--text-3)",
          }}
        >
          <ClientTime iso={m.created_at} />
          {mine && (
            <span aria-label={m.lido ? "Lida" : m.pending ? "Enviando" : "Enviada"}>
              {m.pending ? "…" : m.lido ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Bubble só texto — layout original
  return (
    <div
      className={mine ? "self-end" : "self-start"}
      style={{
        maxWidth: "78%",
        background: mine ? "var(--shine-gold)" : "var(--bg-2)",
        color: mine ? "#1a0f05" : "var(--text-0)",
        padding: "10px 14px",
        borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        fontSize: 14,
        lineHeight: 1.4,
        border: mine ? "none" : "1px solid var(--line)",
        boxShadow: mine
          ? "0 4px 16px rgba(212,175,110,calc(0.25 * var(--shimmer-strength)))"
          : "none",
        opacity: m.pending ? 0.7 : 1,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {m.texto}
      <div
        className="flex items-center justify-end gap-1"
        style={{
          fontSize: 9,
          marginTop: 2,
          color: mine ? "rgba(26,15,5,0.6)" : "var(--text-3)",
        }}
      >
        <ClientTime iso={m.created_at} />
        {mine && (
          <span aria-label={m.lido ? "Lida" : m.pending ? "Enviando" : "Enviada"}>
            {m.pending ? "…" : m.lido ? "✓✓" : "✓"}
          </span>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Renderiza o horário só APÓS hydration — elimina 100% qualquer
 * mismatch de timezone entre server (UTC) e client (local).
 *
 * Server renderiza um placeholder vazio. Client hydrate ainda mostra
 * vazio (mesmo HTML). Depois useEffect dispara e mostra o time real.
 *
 * Mais robusto que suppressHydrationWarning — esse último ainda pode
 * causar React #418 dependendo da versão (já causou em produção 29/04).
 */
function ClientTime({ iso }: { iso: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(formatTime(iso));
  }, [iso]);
  return <span suppressHydrationWarning>{text || " "}</span>;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "há instantes";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days}d`;
  return "faz um tempo";
}

function matchAgeText(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return "agora";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dia${days > 1 ? "s" : ""}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `há ${weeks} sem`;
  const months = Math.floor(days / 30);
  return `há ${months} mes${months > 1 ? "es" : ""}`;
}
