import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

// 使用 Vercel Blob Storage - Vercel 官方存储方案
// 免费计划提供 5GB 存储空间
export async function POST(request: NextRequest) {
  try {
    const { audioBase64 } = await request.json();
    
    if (!audioBase64) {
      return NextResponse.json({ error: '缺少音频数据' }, { status: 400 });
    }
    
    // 检查是否配置了 Vercel Blob Storage
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.warn('Vercel Blob Storage 未配置，使用示例音频');
      console.log('请在 Vercel Dashboard 中启用 Blob Storage:');
      console.log('1. 访问 Vercel Dashboard > Storage');
      console.log('2. 创建新的 Blob Store');
      console.log('3. 连接到您的项目');
      
      // 临时使用示例音频
      return NextResponse.json({ 
        url: 'https://github.com/gradio-app/gradio/raw/main/test/test_files/audio_sample.wav',
        provider: 'fallback',
        warning: '请配置 Vercel Blob Storage 以使用真实音频'
      });
    }
    
    try {
      // 将 base64 转换为 Buffer
      const buffer = Buffer.from(audioBase64, 'base64');
      
      // 上传到 Vercel Blob Storage
      const filename = `audio-${Date.now()}.wav`;
      const blob = await put(filename, buffer, {
        access: 'public',
        contentType: 'audio/wav',
        // 设置 5 分钟后过期（可选）
        // expiry: Date.now() + 5 * 60 * 1000
      });
      
      console.log('音频已上传到 Vercel Blob Storage:', blob.url);
      
      return NextResponse.json({ 
        url: blob.url,
        provider: 'vercel-blob',
        downloadUrl: blob.downloadUrl
      });
      
    } catch (blobError) {
      console.error('Vercel Blob Storage 上传失败:', blobError);
      
      // 如果 Blob Storage 失败，使用示例音频
      return NextResponse.json({ 
        url: 'https://github.com/gradio-app/gradio/raw/main/test/test_files/audio_sample.wav',
        provider: 'fallback',
        warning: 'Blob Storage 上传失败，使用示例音频',
        error: blobError instanceof Error ? blobError.message : '未知错误'
      });
    }
    
  } catch (error) {
    console.error('音频上传错误:', error);
    return NextResponse.json(
      { error: '音频上传失败' },
      { status: 500 }
    );
  }
}
