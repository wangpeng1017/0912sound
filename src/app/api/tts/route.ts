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

    const apiUrl = `${HF_SPACE_URL}${HF_API_NAME}`;
    
    const requestBody: TTSApiRequest = {
      inputs: {
        reference_audio: referenceAudioBase64,
        text: text.trim(),
      },
    };

    console.log('调用 TTS API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('TTS API 错误:', response.status, response.statusText);
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

    const result: TTSApiResponse = await response.json();
    
    if (!result.audio) {
      return NextResponse.json(
        { error: 'API 返回的音频数据为空' },
        { status: 500 }
      );
    }

    return NextResponse.json({ audio: result.audio });

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
