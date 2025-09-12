import { NextRequest, NextResponse } from 'next/server';

const HF_SPACE_URL = process.env.NEXT_PUBLIC_HF_SPACE_URL;
const HF_API_NAME = process.env.NEXT_PUBLIC_HF_API_NAME;
const HF_TOKEN = process.env.HF_TOKEN;

interface TTSApiRequest {
  inputs: {
    reference_audio: string;
    text: string;
  };
}

interface TTSApiResponse {
  audio: string;
}

export async function POST(request: NextRequest) {
  try {
    // 验证环境变量
    if (!HF_SPACE_URL || !HF_API_NAME || !HF_TOKEN) {
      console.error('TTS API 配置不完整:', { 
        hasUrl: !!HF_SPACE_URL, 
        hasApiName: !!HF_API_NAME, 
        hasToken: !!HF_TOKEN 
      });
      return NextResponse.json(
        { error: 'TTS API 配置不完整' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { text, referenceAudioBase64 } = body;

    if (!text || !referenceAudioBase64) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 尝试不同的 API URL 格式
    const possibleUrls = [
      `${HF_SPACE_URL}${HF_API_NAME}`,
      `${HF_SPACE_URL}/api/predict`,
      `https://huggingface.co/spaces/wangpe/2E2-F5-TTS/api/predict`,
      `https://wangpe-2e2-f5-tts.hf.space/api/predict`
    ];
    
    const requestBody: TTSApiRequest = {
      inputs: {
        reference_audio: referenceAudioBase64,
        text: text.trim(),
      },
    };

    // 尝试不同的 URL 格式
    for (const apiUrl of possibleUrls) {
      try {
        console.log('尝试调用 TTS API:', apiUrl);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const result: TTSApiResponse = await response.json();
          
          if (result.audio) {
            console.log('TTS API 调用成功:', apiUrl);
            return NextResponse.json({ audio: result.audio });
          }
        } else if (response.status !== 404) {
          // 如果不是 404 错误，说明找到了正确的端点但有其他问题
          console.error('TTS API 错误:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('错误详情:', errorText);
          
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

          return NextResponse.json(
            { error: errorMessage },
            { status: response.status }
          );
        }
      } catch (error) {
        console.warn(`URL ${apiUrl} 调用失败:`, error);
        continue;
      }
    }

    // 如果所有 URL 都失败了
    console.error('所有 API URL 都调用失败');
    return NextResponse.json(
      { error: 'TTS 服务暂时不可用，请稍后重试' },
      { status: 503 }
    );


  } catch (error) {
    console.error('TTS API 调用错误:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: '网络连接失败，请检查网络连接' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: '语音生成过程中发生未知错误' },
      { status: 500 }
    );
  }
}
