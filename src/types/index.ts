export interface RecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  recordedBlob: Blob | null;
  duration: number;
  error: string | null;
}

export interface TTSApiRequest {
  inputs: {
    reference_audio: string; // Base64 encoded audio
    text: string;
  };
}

export interface TTSApiResponse {
  audio: string; // Base64 encoded audio result
}

export enum RecordingStatus {
  IDLE = 'idle',
  RECORDING = 'recording', 
  COMPLETED = 'completed',
  ERROR = 'error'
}
