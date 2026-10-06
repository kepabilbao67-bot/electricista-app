"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Check, Smartphone, Square } from "lucide-react";

interface AmbientLightSensorLike {
  illuminance?: number;
  start(): void;
  stop(): void;
  addEventListener(type: "reading" | "error", listener: (event: Event) => void): void;
}

type AmbientLightSensorConstructor = new (options?: { frequency?: number }) => AmbientLightSensorLike;

interface NativeLightSensorBridge {
  isAvailable(): boolean;
  start(): boolean;
  stop(): void;
}

interface NativeLightEvent {
  type?: "reading" | "error";
  lux?: number;
  message?: string;
}

interface LightBridgeWindow extends Window {
  AndroidLightSensor?: NativeLightSensorBridge;
  __electricistaLightEvent?: (event: NativeLightEvent) => void;
  AmbientLightSensor?: AmbientLightSensorConstructor;
}

interface PhoneLuxSensorProps {
  onReading: (lux: number) => void;
}

export function PhoneLuxSensor({ onReading }: PhoneLuxSensorProps) {
  const sensorRef = useRef<AmbientLightSensorLike | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "unsupported" | "error">("idle");
  const [source, setSource] = useState<"native" | "web" | null>(null);
  const [lux, setLux] = useState<number | null>(null);

  const stop = () => {
    try {
      (window as unknown as LightBridgeWindow).AndroidLightSensor?.stop();
    } catch {
      // El puente puede haberse detenido ya.
    }
    try {
      sensorRef.current?.stop();
    } catch {
      // El sensor web puede haberse detenido ya.
    }
    sensorRef.current = null;
    setSource(null);
    setStatus((current) => (current === "unsupported" || current === "error" ? current : "idle"));
  };

  useEffect(() => {
    const bridgeWindow = window as unknown as LightBridgeWindow;
    const handler = (event: NativeLightEvent) => {
      if (event?.type === "reading") {
        const value = Number(event.lux);
        if (!Number.isFinite(value) || value < 0) return;
        setLux(Math.round(value * 10) / 10);
        setSource("native");
        setStatus("reading");
        return;
      }
      if (event?.type === "error") {
        setStatus("error");
      }
    };

    bridgeWindow.__electricistaLightEvent = handler;

    return () => {
      try {
        bridgeWindow.AndroidLightSensor?.stop();
      } catch {
        // Limpieza best-effort al desmontar.
      }
      try {
        sensorRef.current?.stop();
      } catch {
        // Limpieza best-effort al desmontar.
      }
      sensorRef.current = null;
      if (bridgeWindow.__electricistaLightEvent === handler) {
        bridgeWindow.__electricistaLightEvent = undefined;
      }
    };
  }, []);

  const start = () => {
    const bridgeWindow = window as unknown as LightBridgeWindow;

    try {
      bridgeWindow.AndroidLightSensor?.stop();
    } catch {
      // Reinicio best-effort.
    }
    try {
      sensorRef.current?.stop();
    } catch {
      // Reinicio best-effort.
    }

    sensorRef.current = null;
    setLux(null);
    setSource(null);

    const nativeSensor = bridgeWindow.AndroidLightSensor;
    if (nativeSensor) {
      try {
        if (nativeSensor.isAvailable() && nativeSensor.start()) {
          setSource("native");
          setStatus("reading");
          return;
        }
      } catch {
        // Si falla el puente nativo, se intenta el sensor web.
      }
    }

    const Sensor = bridgeWindow.AmbientLightSensor;
    if (!Sensor) {
      setStatus("unsupported");
      return;
    }

    try {
      const sensor = new Sensor({ frequency: 2 });
      sensor.addEventListener("reading", () => {
        const value = Number(sensor.illuminance);
        if (!Number.isFinite(value) || value < 0) return;
        setLux(Math.round(value * 10) / 10);
        setSource("web");
        setStatus("reading");
      });
      sensor.addEventListener("error", () => {
        sensorRef.current = null;
        setStatus("error");
      });
      sensorRef.current = sensor;
      sensor.start();
      setSource("web");
      setStatus("reading");
    } catch {
      sensorRef.current = null;
      setStatus("error");
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-500"><Smartphone className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">Sensor de luz del móvil · orientativo</p>
          <p className="mt-1 text-xs text-slate-500">
            En la APK, Luz360 usa primero el sensor de luz nativo de Android. En web intenta Ambient Light Sensor. No sustituye un luxómetro calibrado.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {status === "reading" ? (
          <button type="button" className="btn-secondary" onClick={stop}>
            <Square className="h-4 w-4" /> Detener
          </button>
        ) : (
          <button type="button" className="btn-secondary" onClick={start}>
            <Activity className="h-4 w-4" /> Leer sensor
          </button>
        )}
        <span className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-black text-cyan-300">
          {lux == null ? "— lx" : `${lux.toLocaleString("es-ES")} lx`}
        </span>
        {source ? (
          <span className="rounded-xl border border-cyan-400/20 px-3 py-2 text-[11px] font-bold text-cyan-600 dark:text-cyan-300">
            {source === "native" ? "Sensor Android" : "Sensor web"}
          </span>
        ) : null}
        {lux != null ? (
          <button type="button" className="btn-primary" onClick={() => onReading(lux)}>
            <Check className="h-4 w-4" /> Usar lectura
          </button>
        ) : null}
      </div>

      {status === "reading" && lux != null ? (
        <p className="mt-2 text-xs text-slate-500">
          La lectura se actualiza en vivo. Pulsa «Usar lectura» cuando el valor esté estable.
        </p>
      ) : null}

      {status === "unsupported" ? (
        <p className="mt-2 text-xs font-bold text-amber-600">
          Este dispositivo no expone sensor de luz. Usa un luxómetro y escribe la lectura manualmente.
        </p>
      ) : null}
      {status === "error" ? (
        <p className="mt-2 text-xs font-bold text-red-600">
          El sensor existe pero no se pudo iniciar. Puedes seguir con entrada manual de luxómetro.
        </p>
      ) : null}
    </div>
  );
}
