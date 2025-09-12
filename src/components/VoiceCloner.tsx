'use client';

import { useState, useCallback } from 'react';
import { RecordButton } from './RecordButton';
import { AudioPlayer } from './AudioPlayer';
import { useRecorder } from '@/hooks/useRecorder';
import { RecordingStatus } from '@/types';
import { generateVoice, TTSApiError } from '@/utils/tts-api';

export const VoiceCloner: React.FC = () => {
  const [text, setText] = useState('');
  const [generatedAudio, setGeneratedAudio] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    isRecording,
    recordedBlob,
    duration,
    error: recordError,
    startRecording,
    stopRecording,
    clearRecording,
    getRecordingStatus,
    blobToBase64,
  } = useRecorder();

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setError(null);
  };

  const handleStartRecording = useCallback(() => {
    // 如果已经有录音，先清除
    if (recordedBlob) {
      clearRecording();
    }
    startRecording();
    // 清除之前生成的音频和错误
    setGeneratedAudio(null);
    setError(null);
  }, [recordedBlob, clearRecording, startRecording]);

  const handleGenerateVoice = async () => {
    setError(null);
    
    if (!recordedBlob) {
      setError('请先录制音色样本');
      return;
    }
    
    if (!text.trim()) {
      setError('请输入要生成的文本');
      return;
    }
    
    try {
      setIsGenerating(true);
      
      // 将录音 Blob 转换为 Base64
      const audioBase64 = await blobToBase64(recordedBlob);
      
      // 调用 API 生成语音
      const audioBlob = await generateVoice({
        text: text.trim(),
        referenceAudioBase64: audioBase64,
      });
      
      setGeneratedAudio(audioBlob);
      setIsGenerating(false);
    } catch (error) {
      setIsGenerating(false);
      
      if (error instanceof TTSApiError) {
        setError(error.message);
      } else {
        setError('生成语音时发生未知错误');
        console.error('生成语音错误:', error);
      }
    }
  };

  // 检查是否可以生成语音
  const canGenerate = recordedBlob !== null && text.trim().length > 0 && !isGenerating;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-gray-800">老师喊我去上学</h1>
        <p className="mt-2 text-gray-600">克隆任意声音，生成想要的语音</p>
      </header>

      <div className="space-y-6">
        {/* 文本输入区域 */}
        <div>
          <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-2">
            输入想要生成的文字
          </label>
          <textarea
            id="text-input"
            value={text}
            onChange={handleTextChange}
            placeholder="在此输入要生成的文字..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* 录音区域 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              录制音色样本
            </label>
            <span className="text-xs text-gray-500">
              建议录制 10-15 秒的清晰人声
            </span>
          </div>
          
          <div className="flex justify-center mb-2">
            <RecordButton
              status={getRecordingStatus()}
              duration={duration}
              onStart={handleStartRecording}
              onStop={stopRecording}
              maxDuration={15}
              className="w-full sm:w-auto"
            />
          </div>
          
          {recordError && (
            <div className="text-red-600 text-sm mt-2">
              录音错误: {recordError}
            </div>
          )}
          
          {recordedBlob && (
            <div className="mt-2 p-2 bg-gray-50 rounded-lg text-sm text-gray-700 flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              已录制 {duration} 秒的音频样本
            </div>
          )}
        </div>

        {/* 生成按钮 */}
        <div className="flex justify-center">
          <button
            onClick={handleGenerateVoice}
            disabled={!canGenerate}
            className={`px-6 py-3 text-white rounded-lg transition-colors ${
              canGenerate
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                正在生成语音...
              </>
            ) : (
              '生成语音'
            )}
          </button>
        </div>

        {/* 错误显示 */}
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* 生成的音频播放器 */}
        <div className="mt-6">
          <h2 className="text-lg font-medium text-gray-800 mb-3">生成的语音</h2>
          <AudioPlayer
            audioBlob={generatedAudio}
            title={text ? text.slice(0, 20) + (text.length > 20 ? '...' : '') : '生成的语音'}
          />
        </div>
      </div>

      <footer className="pt-8 mt-8 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} 老师喊我去上学 - 音色克隆 TTS 应用</p>
      </footer>
    </div>
  );
};
