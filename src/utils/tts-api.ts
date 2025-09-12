import { TTSApiRequest, TTSApiResponse } from '@/types';

const HF_SPACE_URL = process.env.NEXT_PUBLIC_HF_SPACE_URL;
const HF_API_NAME = process.env.NEXT_PUBLIC_HF_API_NAME;
const HF_TOKEN = process.env.HF_TOKEN;

interface GenerateVoiceOptions {
  text: string;
  referenceAudioBase64: string;
}

export class TTSApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'TTSApiError';
  }
}

export async function generateVoice({
  text,
  referenceAudioBase64,
}: GenerateVoiceOptions): Promise<Blob> {
  if (!HF_SPACE_URL || !HF_API_NAME || !HF_TOKEN) {
    throw new TTSApiError('TTS API 配置不完整');
  }

  if (!text.trim()) {
    throw new TTSApiError('请输入要生成的文本');
  }

  if (!referenceAudioBase64) {
    throw new TTSApiError('请先录制音色样本');
  }

  try {
    const apiUrl = `${HF_SPACE_URL}${HF_API_NAME}`;
    
    const requestBody: TTSApiRequest = {
      inputs: {
        reference_audio: referenceAudioBase64,
        text: text.trim(),
      },
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = '语音生成失败';
      
      switch (response.status) {
        case 401:
          errorMessage = 'API 认证失败，请检查令牌';
          break;
        case 429:
          errorMessage = 'API 调用频率过高，请稍后重试';
          break;
        case 500:
          errorMessage = '服务器内部错误';
          break;
        case 503:
          errorMessage = 'TTS 服务暂时不可用';
          break;
      }

      throw new TTSApiError(errorMessage, response.status);
    }

    const result: TTSApiResponse = await response.json();
    
    if (!result.audio) {
      throw new TTSApiError('API 返回的音频数据为空');
    }

    // 将 Base64 音频数据转换为 Blob
    const audioData = atob(result.audio);
    const audioArray = new Uint8Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      audioArray[i] = audioData.charCodeAt(i);
    }

    return new Blob([audioArray], { type: 'audio/wav' });

  } catch (error) {
    if (error instanceof TTSApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new TTSApiError('网络连接失败，请检查网络连接');
    }

    console.error('TTS API 调用错误:', error);
    throw new TTSApiError('语音生成过程中发生未知错误');
  }
}

// 音频格式转换工具函数
export async function convertAudioToWav(audioBlob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const fileReader = new FileReader();
    
    fileReader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // 转换为 WAV 格式
        const wavBuffer = audioBufferToWav(audioBuffer);
        const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
        
        resolve(wavBlob);
      } catch {
        reject(new Error('音频格式转换失败'));
      }
    };
    
    fileReader.onerror = () => reject(new Error('读取音频文件失败'));
    fileReader.readAsArrayBuffer(audioBlob);
  });
}

// AudioBuffer 转换为 WAV 格式的工具函数
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;
  
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const length = buffer.length;
  const arrayBuffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(arrayBuffer);
  
  // WAV 文件头
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * blockAlign, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, length * blockAlign, true);
  
  // 写入音频数据
  const channelData = [];
  for (let channel = 0; channel < numChannels; channel++) {
    channelData.push(buffer.getChannelData(channel));
  }
  
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return arrayBuffer;
}
