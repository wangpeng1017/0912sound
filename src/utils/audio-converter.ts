// 音频转换工具
export class AudioConverter {
  /**
   * 将音频 Blob 转换为 WAV 格式
   * @param audioBlob 输入的音频 Blob（通常是 WebM 格式）
   * @param sampleRate 采样率，默认 44100Hz
   * @returns Promise<Blob> WAV格式的音频 Blob
   */
  static async convertToWav(audioBlob: Blob, sampleRate: number = 44100): Promise<Blob> {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    try {
      // 解码音频数据
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // 转换为 WAV 格式
      const wavBuffer = this.audioBufferToWav(audioBuffer, sampleRate);
      return new Blob([wavBuffer], { type: 'audio/wav' });
    } finally {
      // 清理 AudioContext
      if (audioContext.state !== 'closed') {
        await audioContext.close();
      }
    }
  }

  /**
   * 将 AudioBuffer 转换为 WAV 格式的 ArrayBuffer
   */
  private static audioBufferToWav(buffer: AudioBuffer, sampleRate?: number): ArrayBuffer {
    const targetSampleRate = sampleRate || buffer.sampleRate;
    const numberOfChannels = Math.min(buffer.numberOfChannels, 2); // 最多支持双声道
    const length = buffer.length * numberOfChannels * 2; // 16-bit samples
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    
    // WAV 文件头
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    
    // FMT sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * numberOfChannels * 2, true); // byte rate
    view.setUint16(32, numberOfChannels * 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    
    // Data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, length, true);
    
    // 写入音频数据
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  }

  /**
   * 检查浏览器是否支持特定的音频格式
   */
  static isFormatSupported(mimeType: string): boolean {
    return MediaRecorder.isTypeSupported(mimeType);
  }

  /**
   * 获取最佳支持的音频格式
   */
  static getBestSupportedFormat(): string {
    const formats = [
      'audio/wav',
      'audio/webm;codecs=pcm',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg'
    ];

    for (const format of formats) {
      if (this.isFormatSupported(format)) {
        return format;
      }
    }

    return 'audio/webm'; // 回退到默认格式
  }
}