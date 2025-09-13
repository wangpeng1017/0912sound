import { NextRequest, NextResponse } from 'next/server';

const HF_SPACE_URL = process.env.NEXT_PUBLIC_HF_SPACE_URL;
const HF_API_NAME = process.env.NEXT_PUBLIC_HF_API_NAME;
const HF_TOKEN = process.env.HF_TOKEN;


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

    try {
      // 根据官方API文档，使用正确的gradio_client格式
      // API端点是 /api/predict，但HTTP调用时需要使用 /call/predict
      const gradioApiUrl = `${HF_SPACE_URL}/call/predict`;
      
      console.log('调用 Gradio API:', gradioApiUrl);
      console.log('参数:', { textLength: text.length, audioLength: referenceAudioBase64.length });
      
      // 根据官方文档，参数顺序为：ref_audio, ref_text, gen_text, remove_silence
      const requestData = {
        data: [
          // ref_audio - 使用file格式
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
        // 如果是 404，尝试其他端点
        if (response.status === 404) {
          console.log('尝试备用 API 端点');
          // 尝试不同的端点格式
          const altEndpoints = [
            `${HF_SPACE_URL}/run/predict`,
            `${HF_SPACE_URL}/api/predict`, 
            `${HF_SPACE_URL}/gradio_api/run/predict`
          ];
          
          for (const altUrl of altEndpoints) {
            try {
              console.log('尝试端点:', altUrl);
              const altResponse = await fetch(altUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${HF_TOKEN}`,
                },
                body: JSON.stringify(requestData),
              });
              
              if (altResponse.ok) {
                const altResponseText = await altResponse.text();
                console.log('备用端点成功响应:', altResponseText);
                
                try {
                  const altResult = JSON.parse(altResponseText);
                  if (altResult.data && altResult.data.length > 0) {
                    const audioResult = altResult.data[0];
                    if (typeof audioResult === 'string') {
                      let audioData = audioResult;
                      
                      if (audioData.startsWith('data:')) {
                        audioData = audioData.split(',')[1];
                      } else if (audioData.startsWith('http')) {
                        const audioResponse = await fetch(audioData);
                        const audioBuffer = await audioResponse.arrayBuffer();
                        audioData = Buffer.from(audioBuffer).toString('base64');
                      }
                      
                      return NextResponse.json({ audio: audioData });
                    }
                  }
                } catch (parseError) {
                  console.error('解析备用响应失败:', parseError);
                }
              }
            } catch (altError) {
              console.error(`端点 ${altUrl} 调用失败:`, altError);
            }
          }
        }
        
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
      
      // Gradio 异步 API 返回 event_id
      if (result.event_id) {
        console.log('收到 event_id:', result.event_id);
        
        // 轮询结果
        const eventUrl = `${HF_SPACE_URL}/call/predict/${result.event_id}`;
        const maxRetries = 30; // 最多等待 30 秒
        
        for (let i = 0; i < maxRetries; i++) {
          try {
            console.log(`轮询结果 (${i + 1}/${maxRetries}):`, eventUrl);
            
            const eventResponse = await fetch(eventUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${HF_TOKEN}`,
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
