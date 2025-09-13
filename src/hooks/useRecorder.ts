import { useState, useRef, useCallback } from 'react';
import { RecordingState, RecordingStatus } from '@/types';
import { AudioConverter } from '@/utils/audio-converter';

export const useRecorder = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isProcessing: false,
    recordedBlob: null,
    duration: 0,
    error: null,
  });

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startTime = useRef<number>(0);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setRecordingState(prev => ({ 
        ...prev, 
        isProcessing: true, 
        error: null 
      }));

      // 请求麦克风权限
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      stream.current = mediaStream;
      chunks.current = [];

      // 创建 MediaRecorder - 优先尝试 WAV 格式
      let mimeType = 'audio/webm'; // 默认格式
      
      // 尝试找到最佳支持的格式
      if (AudioConverter.isFormatSupported('audio/wav')) {
        mimeType = 'audio/wav';
      } else if (AudioConverter.isFormatSupported('audio/webm;codecs=pcm')) {
        mimeType = 'audio/webm;codecs=pcm';
      } else if (AudioConverter.isFormatSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }
      
      console.log('使用的录音格式:', mimeType);
      
      const recorder = new MediaRecorder(mediaStream, { mimeType });

      mediaRecorder.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const originalBlob = new Blob(chunks.current, { 
          type: chunks.current[0]?.type || mimeType 
        });
        
        let finalBlob = originalBlob;
        
        try {
          // 如果不是 WAV 格式，则转换为 WAV
          if (!originalBlob.type.includes('wav')) {
            console.log('正在转换音频为 WAV 格式...');
            finalBlob = await AudioConverter.convertToWav(originalBlob);
            console.log('音频转换完成');
          }
        } catch (conversionError) {
          console.error('音频转换失败:', conversionError);
          // 如果转换失败，使用原始音频
          finalBlob = originalBlob;
        }
        
        setRecordingState(prev => ({
          ...prev,
          recordedBlob: finalBlob,
          isRecording: false,
          isProcessing: false,
        }));

        // 清理资源
        if (stream.current) {
          stream.current.getTracks().forEach(track => track.stop());
          stream.current = null;
        }
      };

      recorder.onerror = (event) => {
        console.error('录音错误:', event);
        setRecordingState(prev => ({
          ...prev,
          error: '录音过程中发生错误',
          isRecording: false,
          isProcessing: false,
        }));
      };

      // 开始录音
      recorder.start();
      startTime.current = Date.now();
      
      // 开始计时
      durationInterval.current = setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTime.current) / 1000),
        }));
      }, 1000);

      setRecordingState(prev => ({
        ...prev,
        isRecording: true,
        isProcessing: false,
        duration: 0,
      }));

    } catch (error) {
      console.error('启动录音失败:', error);
      let errorMessage = '无法访问麦克风';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = '请允许访问麦克风权限';
        } else if (error.name === 'NotFoundError') {
          errorMessage = '未找到可用的麦克风设备';
        }
      }

      setRecordingState(prev => ({
        ...prev,
        error: errorMessage,
        isProcessing: false,
      }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && recordingState.isRecording) {
      mediaRecorder.current.stop();
      
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    }
  }, [recordingState.isRecording]);

  const clearRecording = useCallback(() => {
    setRecordingState({
      isRecording: false,
      isProcessing: false,
      recordedBlob: null,
      duration: 0,
      error: null,
    });
    
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
  }, []);

  const getRecordingStatus = useCallback((): RecordingStatus => {
    if (recordingState.error) return RecordingStatus.ERROR;
    if (recordingState.isRecording) return RecordingStatus.RECORDING;
    if (recordingState.recordedBlob) return RecordingStatus.COMPLETED;
    return RecordingStatus.IDLE;
  }, [recordingState]);

  // 将 Blob 转换为 Base64
  const blobToBase64 = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // 移除 data:audio/wav;base64, 或其他格式的前缀
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  return {
    ...recordingState,
    startRecording,
    stopRecording,
    clearRecording,
    getRecordingStatus,
    blobToBase64,
  };
};
