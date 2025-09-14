import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// 使用Cloudinary作为可靠的音频存储
// 免费账户提供25GB存储和25GB带宽/月
export async function POST(request: NextRequest) {
  try {
    const { audioBase64 } = await request.json();
    
    if (!audioBase64) {
      return NextResponse.json({ error: '缺少音频数据' }, { status: 400 });
    }
    
    // 方案1: 使用Cloudinary（需要注册免费账户）
    // 在 https://cloudinary.com 注册并获取凭证
    const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
    const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
    
    if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHash('sha256')
        .update(`timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
        .digest('hex');
      
      const formData = new FormData();
      formData.append('file', `data:audio/wav;base64,${audioBase64}`);
      formData.append('timestamp', timestamp.toString());
      formData.append('api_key', CLOUDINARY_API_KEY);
      formData.append('signature', signature);
      formData.append('resource_type', 'video'); // 音频文件使用video类型
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({ 
          url: data.secure_url,
          provider: 'cloudinary'
        });
      }
    }
    
    // 方案2: 使用GitHub Gist作为备用（需要GitHub令牌）
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    
    if (GITHUB_TOKEN) {
      const gistResponse = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: 'Temporary audio file',
          public: true,
          files: {
            'audio.wav': {
              content: audioBase64
            }
          }
        })
      });
      
      if (gistResponse.ok) {
        const gist = await gistResponse.json();
        const rawUrl = gist.files['audio.wav'].raw_url;
        return NextResponse.json({ 
          url: rawUrl,
          provider: 'github-gist'
        });
      }
    }
    
    // 方案3: 使用示例音频作为降级方案
    console.warn('没有配置存储服务，使用示例音频');
    return NextResponse.json({ 
      url: 'https://github.com/gradio-app/gradio/raw/main/test/test_files/audio_sample.wav',
      provider: 'fallback',
      warning: '请配置CLOUDINARY或GITHUB_TOKEN以使用真实音频'
    });
    
  } catch (error) {
    console.error('音频上传错误:', error);
    return NextResponse.json(
      { error: '音频上传失败' },
      { status: 500 }
    );
  }
}