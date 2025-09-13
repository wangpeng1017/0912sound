import { NextRequest, NextResponse } from 'next/server';

const HF_SPACE_URL = process.env.NEXT_PUBLIC_HF_SPACE_URL;
const HF_API_NAME = process.env.NEXT_PUBLIC_HF_API_NAME;
const HF_TOKEN = process.env.HF_TOKEN;

// 处理Gradio响应的通用函数
async function handleGradioResponse(responseText: string, spaceUrl: string, token: string) {
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
  
  // Gradio 异步 API 返回 event_id
  if (result.event_id) {
    console.log('收到 event_id:', result.event_id);
    
    // 轮询结果
    const eventUrl = `${spaceUrl}/gradio_api/call/predict/${result.event_id}`;
    const maxRetries = 30; // 最多等待 30 秒
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`轮询结果 (${i + 1}/${maxRetries}):`, eventUrl);
        
        const eventResponse = await fetch(eventUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!eventResponse.ok) {
          console.log('轮询失败，继续等待:', eventResponse.status);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待 1 秒
          continue;
        }
        
        const eventData = await eventResponse.text();
        console.log('轮询响应:', eventData);
        
        // 检查是否是成功的结果
        if (eventData.includes('"msg":"process_completed"') || eventData.includes('data:')) {
          // 解析结果
          const lines = eventData.split('\n').filter(line => line.trim().startsWith('data:'));
          
          for (const line of lines) {
            try {
              const jsonData = JSON.parse(line.replace('data: ', ''));
              
              if (jsonData.msg === 'process_completed' && jsonData.output && jsonData.output.data) {
                const audioResult = jsonData.output.data[0];
                
                if (typeof audioResult === 'string' && audioResult.startsWith('http')) {
                  // 下载音频文件
                  console.log('下载音频文件:', audioResult);
                  const audioResponse = await fetch(audioResult);
                  const audioBuffer = await audioResponse.arrayBuffer();
                  const base64Audio = Buffer.from(audioBuffer).toString('base64');
                  
                  console.log('TTS API 调用成功，返回音频数据');
                  return NextResponse.json({ audio: base64Audio });
                }
              }
            } catch (lineParseError) {
              console.log('解析行数据失败:', lineParseError);
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待 1 秒
      } catch (eventError) {
        console.error('轮询事件失败:', eventError);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return NextResponse.json(
      { error: '语音生成超时，请稍后重试' },
      { status: 408 }
    );
  }
  
  // 兼容同步 API 格式
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
}

export async function POST(request: NextRequest) {
  try {
    // 验证环境变量
    console.log('环境变量调试信息:', {
      HF_SPACE_URL: HF_SPACE_URL || 'undefined',
      HF_API_NAME: HF_API_NAME || 'undefined', 
      HF_TOKEN: HF_TOKEN ? `${HF_TOKEN.substring(0, 10)}...` : 'undefined',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL
    });
    
    if (!HF_SPACE_URL || !HF_API_NAME || !HF_TOKEN) {
      console.error('TTS API 配置不完整:', { 
        hasUrl: !!HF_SPACE_URL, 
        hasApiName: !!HF_API_NAME, 
        hasToken: !!HF_TOKEN 
      });
      return NextResponse.json(
        { 
          error: 'TTS API 配置不完整', 
          debug: {
            HF_SPACE_URL: HF_SPACE_URL || 'missing',
            HF_API_NAME: HF_API_NAME || 'missing',
            HF_TOKEN: HF_TOKEN ? 'present' : 'missing'
          }
        },
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

  // Demo模式：返回示例音频数据
  if (process.env.DEMO_MODE === 'true' || text.toLowerCase().includes('demo')) {
    console.log('Demo模式激活，返回示例音频');
    
    // 返回一个小的WAV文件的Base64编码（约1秒的静音）
    const demoAudio = 'UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmUfCkaV2PHEeycFJHfH8N2QQAoUXrTp66hVFApGn+DyvmUfCk';
    
    return NextResponse.json({ 
      audio: demoAudio,
      demo: true,
      message: `Demo模式 - 模拟生成: "${text}"`
    });
  }

    try {
      // 根据Gradio JavaScript客户端文档，使用正确的API格式
      // 首先尝试/gradio_api/call/predict端点
      const gradioApiUrl = `${HF_SPACE_URL}/gradio_api/call/predict`;
      
      console.log('调用 Gradio API:', gradioApiUrl);
      console.log('参数:', { textLength: text.length, audioLength: referenceAudioBase64.length });
      
      // 根据截图显示的cURL命令，使用FileData格式
      const requestData = {
        data: [
          // ref_audio - 使用FileData格式
          {
            "path": "reference_audio.wav",
            "meta": {"_type": "gradio.FileData"},
            "url": `data:audio/wav;base64,${referenceAudioBase64}`
          },
          text.trim(), // ref_text
          text.trim(), // gen_text 
          true // remove_silence - 按照截图设置为true
        ]
      };
      
      console.log('Gradio 请求数据格式:', JSON.stringify(requestData).substring(0, 200) + '...');
      
      // 第一次尝试：直接调用
      const response = await fetch(gradioApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HF_TOKEN}`,
        },
        body: JSON.stringify(requestData),
      });
      
      // 如果第一次失败，尝试使用文件对象格式
      if (!response.ok && response.status === 404) {
        console.log('尝试文件对象格式');
        
        const fileRequestData = {
          data: [
            // ref_audio - 使用文件对象格式
            {
              "path": `audio_${Date.now()}.wav`,
              "url": `data:audio/wav;base64,${referenceAudioBase64}`,
              "orig_name": "reference_audio.wav",
              "size": Math.floor(referenceAudioBase64.length * 0.75),
              "mime_type": "audio/wav"
            },
            text.trim(), // ref_text
            text.trim(), // gen_text 
            false // remove_silence
          ]
        };
        
        const fileResponse = await fetch(gradioApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${HF_TOKEN}`,
          },
          body: JSON.stringify(fileRequestData),
        });
        
        if (fileResponse.ok) {
          // 如果文件格式成功，使用这个响应
          const responseText = await fileResponse.text();
          console.log('文件格式成功响应:', responseText);
          
          // 继续处理响应...
          return await handleGradioResponse(responseText, HF_SPACE_URL, HF_TOKEN);
        }
      }
      
      // 如果第一次就成功，直接处理
      if (response.ok) {
        const responseText = await response.text();
        console.log('直接调用成功响应:', responseText);
        return await handleGradioResponse(responseText, HF_SPACE_URL, HF_TOKEN);
      }

      console.log('Gradio 请求数据格式:', JSON.stringify(requestData, null, 2));

      const response = await fetch(gradioApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HF_TOKEN}`,
        },
        body: JSON.stringify(requestData),
      });

      // 如果都失败，返回错误信息
      const responseText = await response.text();
      console.error('Gradio API 错误:', response.status, response.statusText);
      console.error('错误详情:', responseText);
      
      let errorMessage = '语音生成失败';
      
      switch (response.status) {
        case 401:
          errorMessage = 'API 认证失败，请检查令牌';
          break;
        case 404:
          errorMessage = 'API 端点未找到，该服务可能暂时不可用';
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
