import { NextRequest, NextResponse } from 'next/server';

const HF_SPACE_URL = process.env.NEXT_PUBLIC_HF_SPACE_URL;
const HF_API_NAME = process.env.NEXT_PUBLIC_HF_API_NAME;
const HF_TOKEN = process.env.HF_TOKEN;


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

    try {
      // 根据 Gradio 文档，对于 Hugging Face Space，需要使用特定的 API 格式
      const gradioApiUrl = `${HF_SPACE_URL}/api/predict`;
      
      console.log('调用 Gradio API:', gradioApiUrl);
      console.log('参数:', { textLength: text.length, audioLength: referenceAudioBase64.length });
      
      // 根据 Gradio 的 HTTP API 文档，需要使用 data 数组格式
      // F5-TTS 应用的参数顺序：[reference_audio, reference_text, generate_text, remove_silence]
      const requestData = {
        data: [
          {
            name: "reference_audio.wav",
            data: `data:audio/wav;base64,${referenceAudioBase64}`
          },
          text.trim(), // reference text
          text.trim(), // generation text  
          false // remove silence
        ]
      };

      console.log('Gradio 请求数据格式:', JSON.stringify(requestData, null, 2));

      const response = await fetch(gradioApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HF_TOKEN}`,
        },
        body: JSON.stringify(requestData),
      });

      console.log('Gradio API 响应状态:', response.status);
      
      const responseText = await response.text();
      console.log('Gradio API 响应内容:', responseText);

      if (!response.ok) {
        console.error('Gradio API 错误:', response.status, response.statusText);
        console.error('错误详情:', responseText);
        
        let errorMessage = '语音生成失败';
        
        switch (response.status) {
          case 401:
            errorMessage = 'API 认证失败，请检查令牌';
            break;
          case 422:
            errorMessage = '请求参数错误，请检查音频格式和文本内容';
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
          { error: errorMessage, details: responseText },
          { status: response.status }
        );
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON 解析错误:', parseError);
        return NextResponse.json(
          { error: 'API 返回数据格式错误' },
          { status: 500 }
        );
      }
      
      console.log('Gradio API 成功响应:', result);
      
      // Gradio 返回格式通常是 { data: [...] }
      if (result.data && result.data.length > 0) {
        const audioResult = result.data[0];
        
        // 音频数据可能是 URL 或者 base64
        if (typeof audioResult === 'string') {
          let audioData = audioResult;
          
          // 如果是 data URL，提取 base64 部分
          if (audioData.startsWith('data:')) {
            audioData = audioData.split(',')[1];
          }
          // 如果是文件 URL，需要下载文件
          else if (audioData.startsWith('http')) {
            try {
              console.log('下载音频文件:', audioData);
              const audioResponse = await fetch(audioData);
              const audioBuffer = await audioResponse.arrayBuffer();
              const base64Audio = Buffer.from(audioBuffer).toString('base64');
              audioData = base64Audio;
            } catch (downloadError) {
              console.error('下载音频文件失败:', downloadError);
              return NextResponse.json(
                { error: '无法下载生成的音频文件' },
                { status: 500 }
              );
            }
          }
          
          console.log('TTS API 调用成功，返回音频数据');
          return NextResponse.json({ audio: audioData });
        }
      }
      
      console.error('意外的 API 响应格式:', result);
      return NextResponse.json(
        { error: 'API 返回的音频数据格式异常', details: result },
        { status: 500 }
      );
      
    } catch (error) {
      console.error('Gradio API 调用异常:', error);
      return NextResponse.json(
        { 
          error: 'TTS 服务暂时不可用，请稍后重试', 
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 503 }
      );
    }



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
