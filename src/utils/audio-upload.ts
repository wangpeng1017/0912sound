/**
 * 音频上传服务
 * 将音频数据上传到临时存储并返回URL
 */

export class AudioUploadService {
  /**
   * 将base64音频数据转换为Blob
   */
  static base64ToBlob(base64: string, mimeType: string = 'audio/wav'): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * 上传音频到免费的临时文件存储服务
   * 使用 file.io (免费，文件保存14天)
   */
  static async uploadToFileIO(audioBase64: string): Promise<string> {
    try {
      const blob = this.base64ToBlob(audioBase64, 'audio/wav');
      const formData = new FormData();
      formData.append('file', blob, 'audio.wav');
      
      const response = await fetch('https://file.io', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('上传失败');
      }
      
      const data = await response.json();
      return data.link;
    } catch (error) {
      console.error('file.io 上传失败:', error);
      throw error;
    }
  }

  /**
   * 上传到 tmpfiles.org (另一个免费临时存储)
   */
  static async uploadToTmpFiles(audioBase64: string): Promise<string> {
    try {
      const blob = this.base64ToBlob(audioBase64, 'audio/wav');
      const formData = new FormData();
      formData.append('file', blob, 'audio.wav');
      
      const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('上传失败');
      }
      
      const data = await response.json();
      // tmpfiles.org 返回的URL需要转换为直接下载链接
      const url = data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      return url;
    } catch (error) {
      console.error('tmpfiles.org 上传失败:', error);
      throw error;
    }
  }

  /**
   * 尝试多个服务上传音频
   */
  static async uploadAudio(audioBase64: string): Promise<string> {
    // 尝试不同的上传服务
    const uploadMethods = [
      () => this.uploadToTmpFiles(audioBase64),
      () => this.uploadToFileIO(audioBase64),
    ];
    
    for (const method of uploadMethods) {
      try {
        const url = await method();
        console.log('音频上传成功:', url);
        return url;
      } catch (error) {
        console.warn('上传方法失败，尝试下一个:', error);
      }
    }
    
    throw new Error('所有上传方法都失败了');
  }
}