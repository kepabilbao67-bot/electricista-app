/**
 * Captura de audio para Voz 360
 * Componente reutilizable para Web/React/Next
 */

import type { AudioMetrics, BargeInConfig } from './types';

export interface AudioCaptureConfig {
  /** Restricciones de audio */
  constraints: MediaTrackConstraints;
  /** Tamaño de chunk en muestras */
  chunkSize: number;
  /** Tasa de muestreo */
  sampleRate: number;
  /** Configuración de barge-in */
  bargeIn?: BargeInConfig;
}

export interface AudioCaptureCallbacks {
  /** Llamado cuando se recibe chunk de audio */
  onAudioChunk?: (chunk: ArrayBuffer, sampleRate: number) => void;
  /** Llamado cuando hay errores */
  onError?: (error: Error) => void;
  /** Llamado cuando cambian las métricas de audio */
  onMetrics?: (metrics: AudioMetrics) => void;
  /** Llamado cuando se detecta barge-in */
  onBargeIn?: () => void;
}

/**
 * Clase para captura y procesamiento de audio PCM
 */
export class AudioCapture {
  private config: AudioCaptureConfig;
  private callbacks: AudioCaptureCallbacks;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isCapturing = false;
  private metrics: AudioMetrics;
  private bargeInDetected = false;
  private bargeInTimeout: NodeJS.Timeout | null = null;

  constructor(config: AudioCaptureConfig, callbacks: AudioCaptureCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
    this.metrics = {
      volume: -Infinity,
      isSpeechActive: false,
      isSilent: true,
      processingLatency: 0,
      bufferSize: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Iniciar captura de audio
   */
  async start(): Promise<MediaStream> {
    try {
      // Obtener stream del micrófono
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: this.config.constraints,
      });

      // Crear contexto de audio
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate,
      });

      // Crear nodos de procesamiento
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processorNode = this.audioContext.createScriptProcessor(
        this.config.chunkSize,
        1,
        1
      );

      // Configurar procesamiento de audio
      this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
        this.processAudio(event);
      };

      // Conectar nodos
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isCapturing = true;
      return this.mediaStream;

    } catch (error) {
      throw new Error(`Error al iniciar captura de audio: ${error}`);
    }
  }

  /**
   * Detener captura de audio
   */
  stop(): void {
    this.isCapturing = false;

    // Desconectar nodos
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Detener pistas de audio
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Cerrar contexto de audio
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Limpiar timeout de barge-in
    if (this.bargeInTimeout) {
      clearTimeout(this.bargeInTimeout);
      this.bargeInTimeout = null;
    }
  }

  /**
   * Procesar audio PCM
   */
  private processAudio(event: AudioProcessingEvent): void {
    if (!this.isCapturing) return;

    const startTime = performance.now();
    const inputBuffer = event.inputBuffer;
    const channelData = inputBuffer.getChannelData(0);

    // Convertir Float32 [-1, 1] a Int16 [-32768, 32767]
    const int16Data = new Int16Array(channelData.length);
    let maxAmplitude = 0;

    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i])); // Clamp
      int16Data[i] = Math.round(sample * 32767);
      maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
    }

    // Calcular métricas
    const db = maxAmplitude > 0 ? 20 * Math.log10(maxAmplitude) : -Infinity;
    
    this.metrics = {
      volume: db,
      isSpeechActive: db > -40, // Umbral de voz activa
      isSilent: db < -60, // Umbral de silencio
      processingLatency: performance.now() - startTime,
      bufferSize: int16Data.length,
      timestamp: Date.now(),
    };

    // Enviar métricas
    this.callbacks.onMetrics?.(this.metrics);

    // Detectar barge-in si está habilitado
    if (this.config.bargeIn?.enabled) {
      this.detectBargeIn(db);
    }

    // Enviar chunk de audio
    this.callbacks.onAudioChunk?.(int16Data.buffer, this.config.sampleRate);
  }

  /**
   * Detectar barge-in
   */
  private detectBargeIn(db: number): void {
    const threshold = this.config.bargeIn?.threshold || -30;
    const debounce = this.config.bargeIn?.debounce || 300;

    const isBargeIn = db > threshold;

    if (isBargeIn && !this.bargeInDetected) {
      // Detectar barge-in con debounce
      if (this.bargeInTimeout) {
        clearTimeout(this.bargeInTimeout);
      }

      this.bargeInTimeout = setTimeout(() => {
        this.bargeInDetected = true;
        this.callbacks.onBargeIn?.();
      }, debounce);
    } else if (!isBargeIn) {
      this.bargeInDetected = false;
      if (this.bargeInTimeout) {
        clearTimeout(this.bargeInTimeout);
        this.bargeInTimeout = null;
      }
    }
  }

  /**
   * Reiniciar detección de barge-in
   */
  resetBargeIn(): void {
    this.bargeInDetected = false;
    if (this.bargeInTimeout) {
      clearTimeout(this.bargeInTimeout);
      this.bargeInTimeout = null;
    }
  }

  /**
   * Obtener métricas actuales
   */
  getMetrics(): AudioMetrics {
    return { ...this.metrics };
  }

  /**
   * Verificar si está capturando
   */
  isActive(): boolean {
    return this.isCapturing;
  }

  /**
   * Obtener configuración actual
   */
  getConfig(): AudioCaptureConfig {
    return { ...this.config };
  }

  /**
   * Actualizar configuración
   */
  updateConfig(updates: Partial<AudioCaptureConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Verificar compatibilidad del navegador
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' &&
           'AudioContext' in window &&
           'getUserMedia' in navigator.mediaDevices;
  }

  /**
   * Obtener constraints soportados
   */
  static getSupportedConstraints(): MediaTrackSupportedConstraints {
    return navigator.mediaDevices.getSupportedConstraints();
  }

  /**
   * Crear configuración óptima para Voz 360
   */
  static createOptimalConfig(sampleRate: number = 16000): AudioCaptureConfig {
    const supported = this.getSupportedConstraints();
    
    const constraints: MediaTrackConstraints = {
      channelCount: 1,
      sampleRate: sampleRate,
    };

    // Aplicar solo constraints soportados
    if (supported.echoCancellation) {
      constraints.echoCancellation = true;
    }
    if (supported.noiseSuppression) {
      constraints.noiseSuppression = true;
    }
    if (supported.autoGainControl) {
      constraints.autoGainControl = true;
    }
    if (supported.sampleRate) {
      constraints.sampleRate = sampleRate;
    }

    return {
      constraints,
      chunkSize: 4096, // ~250ms a 16kHz
      sampleRate,
      bargeIn: {
        enabled: true,
        threshold: -30, // dBFS
        debounce: 300, // ms
      },
    };
  }
}