"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, AlertCircle } from "lucide-react";

interface VoiceDictationProps {
  onTranscriptComplete: (text: string) => void;
  className?: string;
  language?: string;
  disabled?: boolean;
}

export default function VoiceDictation({
  onTranscriptComplete,
  className = "",
  language = "es-ES",
  disabled = false,
}: VoiceDictationProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setIsSupported(false);
      }
    }
  }, []);

  const startListening = () => {
    if (!isSupported || disabled) return;

    setError(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
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
          setError(event.error || "Error al capturar voz");
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

  if (!isSupported) {
    return (
      <span
        className={`inline-flex items-center text-xs text-slate-400 p-1.5 rounded-lg bg-slate-50 border border-slate-200 cursor-not-allowed ${className}`}
        title="El dictado por voz no es compatible con este navegador."
      >
        <MicOff className="h-4 w-4" />
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        title={
          isListening
            ? "Escuchando... Pulsa para detener"
            : "Dictar por voz (Español)"
        }
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
          isListening
            ? "bg-rose-50 border-rose-300 text-rose-700 animate-pulse ring-2 ring-rose-200"
            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
      >
        <Mic className={`h-3.5 w-3.5 ${isListening ? "text-rose-600" : "text-slate-500"}`} />
        <span>{isListening ? "Escuchando..." : "Dictar"}</span>
      </button>

      {error && (
        <span
          className="text-xs text-rose-500 flex items-center gap-0.5"
          title={error}
        >
          <AlertCircle className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}
