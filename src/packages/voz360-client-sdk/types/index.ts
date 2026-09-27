/**
 * Tipos para el SDK cliente de Voz 360
 */

export interface VoiceClientConfig {
  apiUrl: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  audioConstraints: MediaTrackConstraints;
  chunkSize: number; // en muestras
  sampleRate: number;
}

export interface AudioMetrics {
  volume: number; // en dBFS
  isSpeechActive: boolean;
  isSilent: boolean;
  processingLatency: number;
  bufferSize: number;
  timestamp: number;
}

export interface BargeInConfig {
  enabled: boolean;
  threshold: number; // en dBFS
  debounce: number; // en ms
}