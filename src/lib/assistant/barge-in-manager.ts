/**
 * Gestor de barge-in (interrupción natural) para Gemini Live
 * 
 * Detecta cuando el usuario habla mientras Gemini está respondiendo
 * y maneja la cancelación limpia del audio anterior.
 */

export interface BargeInConfig {
  /**
   * Umbral de volumen para detectar voz del usuario (0-1)
   * @default 0.15
   */
  volumeThreshold: number;
  
  /**
   * Duración mínima de silencio para considerar fin de frase (ms)
   * @default 800
   */
  silenceDurationMs: number;
  
  /**
   * Tamaño del buffer para análisis de volumen
   * @default 1024
   */
  bufferSize: number;
  
  /**
   * Muestrear cada N milisegundos
   * @default 50
   */
  sampleIntervalMs: number;
}

export class BargeInManager {
  private config: BargeInConfig;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isMonitoring = false;
  private monitoringInterval: number | null = null;
  private lastVoiceTime = 0;
  private isUserSpeaking = false;
  private isGeminiSpeaking = false;
  private pendingAudioBuffers: AudioBufferSourceNode[] = [];
  
  // Callbacks
  private onBargeInCallback: (() => void) | null = null;
  private onSilenceCallback: (() => void) | null = null;

  constructor(config?: Partial<BargeInConfig>) {
    this.config = {
      volumeThreshold: 0.15,
      silenceDurationMs: 800,
      bufferSize: 1024,
      sampleIntervalMs: 50,
      ...config
    };
  }

  /**
   * Inicializar con stream de audio
   */
  async initialize(stream: MediaStream): Promise<void> {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      
      this.analyser.fftSize = this.config.bufferSize;
      this.analyser.smoothingTimeConstant = 0.8;
      
      this.source.connect(this.analyser);
      
      console.log('[BargeInManager] Inicializado correctamente');
      
    } catch (error) {
      console.error('[BargeInManager] Error inicializando:', error);
      throw new Error(`No se pudo inicializar barge-in: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Comenzar monitoreo de voz del usuario
   */
  startMonitoring(): void {
    if (!this.analyser || this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.lastVoiceTime = Date.now();
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.monitoringInterval = window.setInterval(() => {
      if (!this.analyser) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      const averageVolume = this.calculateAverageVolume(dataArray);
      
      const hasVoice = averageVolume > this.config.volumeThreshold;
      const currentTime = Date.now();
      const silenceDuration = currentTime - this.lastVoiceTime;
      
      // Detectar inicio de voz
      if (hasVoice && !this.isUserSpeaking) {
        this.isUserSpeaking = true;
        this.lastVoiceTime = currentTime;
        
        // Si Gemini está hablando, activar barge-in
        if (this.isGeminiSpeaking) {
          this.triggerBargeIn();
        }
      }
      
      // Detectar fin de voz
      if (!hasVoice && this.isUserSpeaking) {
        if (silenceDuration >= this.config.silenceDurationMs) {
          this.isUserSpeaking = false;
          if (this.onSilenceCallback) {
            this.onSilenceCallback();
          }
        }
      }
      
      // Actualizar tiempo si sigue hablando
      if (hasVoice) {
        this.lastVoiceTime = currentTime;
      }
      
    }, this.config.sampleIntervalMs);
    
    console.log('[BargeInManager] Monitoreo iniciado');
  }

  /**
   * Detener monitoreo
   */
  stopMonitoring(): void {
    if (this.monitoringInterval !== null) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    this.isUserSpeaking = false;
    
    console.log('[BargeInManager] Monitoreo detenido');
  }

  /**
   * Marcar que Gemini está hablando (reproduciendo audio)
   */
  startGeminiSpeech(): void {
    this.isGeminiSpeaking = true;
    console.log('[BargeInManager] Gemini hablando');
  }

  /**
   * Marcar que Gemini terminó de hablar
   */
  stopGeminiSpeech(): void {
    this.isGeminiSpeaking = false;
    console.log('[BargeInManager] Gemini terminó de hablar');
  }

  /**
   * Activar barge-in: detener audio de Gemini y limpiar buffers
   */
  triggerBargeIn(): void {
    console.log('[BargeInManager] Barge-in detectado, cancelando audio de Gemini');
    
    // Detener todos los buffers de audio pendientes
    this.pendingAudioBuffers.forEach(buffer => {
      try {
        buffer.stop();
      } catch (error) {
        // Ignorar errores si ya estaba detenido
      }
    });
    
    this.pendingAudioBuffers = [];
    
    // Notificar al callback
    if (this.onBargeInCallback) {
      this.onBargeInCallback();
    }
    
    // Actualizar estado
    this.isGeminiSpeaking = false;
  }

  /**
   * Registrar buffer de audio para poder cancelarlo si hay barge-in
   */
  registerAudioBuffer(buffer: AudioBufferSourceNode): void {
    this.pendingAudioBuffers.push(buffer);
    
    // Configurar para auto-eliminación cuando termine
    buffer.onended = () => {
      const index = this.pendingAudioBuffers.indexOf(buffer);
      if (index !== -1) {
        this.pendingAudioBuffers.splice(index, 1);
      }
    };
  }

  /**
   * Calcular volumen promedio de los datos de frecuencia
   */
  private calculateAverageVolume(dataArray: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length / 255; // Normalizar a 0-1
  }

  /**
   * Configurar callbacks
   */
  onBargeIn(callback: () => void): void {
    this.onBargeInCallback = callback;
  }
  
  onSilence(callback: () => void): void {
    this.onSilenceCallback = callback;
  }

  /**
   * Limpiar recursos
   */
  cleanup(): void {
    this.stopMonitoring();
    
    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.source = null;
    this.pendingAudioBuffers = [];
    
    console.log('[BargeInManager] Recursos limpiados');
  }

  /**
   * Obtener estado actual
   */
  getState() {
    return {
      isMonitoring: this.isMonitoring,
      isUserSpeaking: this.isUserSpeaking,
      isGeminiSpeaking: this.isGeminiSpeaking,
      lastVoiceTime: this.lastVoiceTime,
      pendingBuffersCount: this.pendingAudioBuffers.length
    };
  }
}

// Manager por defecto
export const defaultBargeInManager = new BargeInManager();