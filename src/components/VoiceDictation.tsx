"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, AlertCircle } from "lucide-react";

interface VoiceDictationProps {
  onTranscriptComplete: (text: string) => void;
  className?: string;
  language?: string;
  disabled?: boolean;
}

/**
 * Modo de dictado realmente disponible:
 *  - "native": puente Android (window.AndroidSTT) → reconocedor del propio teléfono.
 *  - "web":    Web Speech API (Chrome/escritorio en contexto seguro).
 *  - "none":   no hay ningún motor; se avisa en pantalla, NO se simula éxito.
 */
type SttMode = "native" | "web" | "none";

const SIN_MOTOR_TEXTO = "Dictado no disponible aquí";
const SIN_MOTOR_TITULO =
  "Este WebView no expone la Web Speech API y no hay puente nativo. " +
  "Escribe la orden con el teclado.";

/** Traduce los códigos de error de la Web Speech API a algo legible. */
const ERRORES_WEB: Record<string, string> = {
  "not-allowed":
    "Micrófono denegado o contexto no seguro (en movil usa el dictado nativo)",
  "service-not-allowed": "El navegador no permite el dictado en este origen",
  "audio-capture": "No se detecta micrófono",
  network: "Sin conexión con el servicio de dictado",
};

export default function VoiceDictation({
  onTranscriptComplete,
  className = "",
  language = "es-ES",
  disabled = false,
}: VoiceDictationProps) {
  const [isListening, setIsListening] = useState(false);
  // Valor inicial neutro para no romper la hidratación: el modo real se resuelve
  // en el cliente, dentro de useEffect (nunca durante el render del servidor).
  const [mode, setMode] = useState<SttMode>("web");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const modoRef = useRef<SttMode>("web");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as any;

    const puenteNativo = !!(w.AndroidSTT && typeof w.AndroidSTT.start === "function");
    const webSpeech = w.SpeechRecognition || w.webkitSpeechRecognition;
    const resuelto: SttMode = puenteNativo ? "native" : webSpeech ? "web" : "none";

    modoRef.current = resuelto;
    setMode(resuelto);

    // Diagnóstico explícito: aparece en la consola del navegador y en el logcat del móvil.
    console.log("[VOZ360][STT] deteccion", {
      puenteNativo,
      webSpeech: !!webSpeech,
      isSecureContext: w.isSecureContext,
      mediaDevices: typeof navigator.mediaDevices,
      modo: resuelto,
    });

    if (puenteNativo) {
      w.__onNativeSttResult = (texto: unknown) => {
        setIsListening(false);
        const t = typeof texto === "string" ? texto.trim() : "";
        if (t) {
          setError(null);
          onTranscriptComplete(t);
        }
      };
      w.__onNativeSttError = (motivo: unknown) => {
        setIsListening(false);
        const m = String(motivo ?? "");
        // El usuario que cierra el dictado del sistema no es un error que deba mostrarse.
        if (m && m !== "CANCELADO") setError("Dictado: " + m);
      };
      return () => {
        delete w.__onNativeSttResult;
        delete w.__onNativeSttError;
      };
    }
  }, [onTranscriptComplete]);

  const startListening = () => {
    if (disabled) return;
    setError(null);

    // 1) Reconocedor nativo del teléfono (Android WebView).
    if (modoRef.current === "native") {
      try {
        setIsListening(true);
        (window as any).AndroidSTT.start();
      } catch {
        setIsListening(false);
        setError("No se pudo iniciar el dictado nativo");
      }
      return;
    }

    // 2) Sin motor disponible: aviso honesto, sin simular que escucha.
    if (modoRef.current === "none") {
      setError(SIN_MOTOR_TEXTO);
      return;
    }

    // 3) Web Speech API (escritorio / contexto seguro).
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(SIN_MOTOR_TEXTO);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript && typeof transcript === "string") {
          onTranscriptComplete(transcript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          setError(ERRORES_WEB[event.error] || event.error || "Error al capturar voz");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setError("No se pudo iniciar el reconocimiento de voz");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (modoRef.current === "native") {
      setIsListening(false);
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const sinMotor = mode === "none";

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        title={
          sinMotor
            ? SIN_MOTOR_TITULO
            : isListening
              ? "Escuchando... Pulsa para detener"
              : "Dictar por voz (Español)"
        }
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
          isListening
            ? "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 animate-pulse ring-2 ring-rose-200 dark:ring-rose-900"
            : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
      >
        {sinMotor ? (
          <MicOff className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
        ) : (
          <Mic className={`h-3.5 w-3.5 ${isListening ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`} />
        )}
        <span>{isListening ? "Escuchando..." : "Dictar"}</span>
      </button>

      {error && (
        <span
          className="text-xs text-rose-500 dark:text-rose-400 flex items-center gap-0.5"
          title={error}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[13rem] truncate">{error}</span>
        </span>
      )}
    </div>
  );
}
