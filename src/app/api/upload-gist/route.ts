import { NextRequest, NextResponse } from 'next/server';

// 使用 GitHub Gist 存储音频 - F5-TTS 能访问 GitHub
export async function POST(request: NextRequest) {
  try {
    const { audioBase64 } = await request.json();
    
    if (!audioBase64) {
      return NextResponse.json({ error: '缺少音频数据' }, { status: 400 });
    }
    
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    
    if (!GITHUB_TOKEN) {
      console.warn('未配置 GITHUB_TOKEN');
      return NextResponse.json({ 
        url: 'https://github.com/gradio-app/gradio/raw/main/test/test_files/audio_sample.wav',
        provider: 'fallback',
        warning: '请配置 GITHUB_TOKEN 以使用真实音频'
      });
    }
    
    try {
      // 创建 Gist
      const gistResponse = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          description: `TTS audio ${new Date().toISOString()}`,
          public: true,
          files: {
            'audio.wav': {
              content: `data:audio/wav;base64,${audioBase64}`
            }
          }
        })
      });
      
      if (!gistResponse.ok) {
        const error = await gistResponse.text();
        console.error('GitHub Gist 创建失败:', error);
        throw new Error(`GitHub API error: ${gistResponse.status}`);
      }
      
      const gist = await gistResponse.json();
      
      // 获取原始文件URL
      const rawUrl = gist.files['audio.wav'].raw_url;
      
      console.log('音频已上传到 GitHub Gist:', rawUrl);
      
      // 从raw_url中提取base64数据并重新上传为二进制
      // GitHub Gist不直接支持二进制，需要特殊处理
      
      // 更新Gist，使用特殊的base64标记
      const updateResponse = await fetch(`https://api.github.com/gists/${gist.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: {
            'audio.wav': {
              content: audioBase64,
              filename: 'audio.b64'
            }
          }
        })
      });
      
      if (updateResponse.ok) {
        const updatedGist = await updateResponse.json();
        const b64Url = updatedGist.files['audio.b64'].raw_url;
        
        // 返回一个转换服务URL（需要额外的转换步骤）
        return NextResponse.json({ 
          url: b64Url,
          gistId: gist.id,
          provider: 'github-gist-b64',
          needsConversion: true,
          fallbackUrl: 'https://github.com/gradio-app/gradio/raw/main/test/test_files/audio_sample.wav'
        });
      }
      
      return NextResponse.json({ 
        url: rawUrl,
        gistId: gist.id,
        provider: 'github-gist'
      });
      
    } catch (gistError) {
      console.error('GitHub Gist 上传失败:', gistError);
      
      return NextResponse.json({ 
        url: 'https://github.com/gradio-app/gradio/raw/main/test/test_files/audio_sample.wav',
        provider: 'fallback',
        warning: 'Gist 上传失败，使用示例音频',
        error: gistError instanceof Error ? gistError.message : '未知错误'
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