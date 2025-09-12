'use client';

import { useState, useEffect } from 'react';
import { RecordingStatus } from '@/types';

interface RecordButtonProps {
  status: RecordingStatus;
  duration: number;
  onStart: () => void;
  onStop: () => void;
  maxDuration?: number;
  className?: string;
  isProcessing?: boolean;
}

export const RecordButton: React.FC<RecordButtonProps> = ({
  status,
  duration,
  onStart,
  onStop,
  maxDuration = 15,
  className = '',
  isProcessing = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isError, setIsError] = useState(false);

  // 基于传入的状态更新本地状态
  useEffect(() => {
    setIsRecording(status === RecordingStatus.RECORDING);
    setIsDone(status === RecordingStatus.COMPLETED);
    setIsError(status === RecordingStatus.ERROR);
  }, [status]);

  // 如果超过最大录音时间，自动停止
  useEffect(() => {
    if (isRecording && duration >= maxDuration) {
      onStop();
    }
  }, [isRecording, duration, maxDuration, onStop]);

  const handleClick = () => {
    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
  };

  const getButtonColor = () => {
    if (isError) return 'bg-red-600 hover:bg-red-700';
    if (isDone) return 'bg-green-600 hover:bg-green-700';
    if (isRecording) return 'bg-red-600 hover:bg-red-700 animate-pulse';
    return 'bg-blue-600 hover:bg-blue-700';
  };

  const getButtonText = () => {
    if (isError) return '录音错误，重试';
    if (isDone) return '重新录制';
    if (isRecording) return `正在录音 (${duration}s)`;
    return '开始录音';
  };

  const getButtonIcon = () => {
    if (isError) {
      return (
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    
    if (isDone) {
      return (
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    
    if (isRecording) {
      return (
        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      );
    }
    
    return (
      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    );
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center justify-center px-4 py-2 text-white rounded-lg transition-colors ${getButtonColor()} ${className}`}
      disabled={isProcessing}
    >
      {getButtonIcon()}
      <span>{getButtonText()}</span>
      
      {/* 录音时间进度条 */}
      {isRecording && (
        <div className="relative ml-2 w-24 h-2 bg-white bg-opacity-30 rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-white"
            style={{ width: `${(duration / maxDuration) * 100}%` }}
          />
        </div>
      )}
    </button>
  );
};
