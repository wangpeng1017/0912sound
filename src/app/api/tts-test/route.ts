import { NextRequest, NextResponse } from 'next/server';

// 测试路由 - 使用官方示例音频
export async function GET(request: NextRequest) {
  try {
    const HF_SPACE_URL = process.env.NEXT_PUBLIC_HF_SPACE_URL || 'https://wangpe-2e2-f5-tts.hf.space';
    const HF_TOKEN = process.env.HF_TOKEN;
    
    // 使用官方示例的音频文件
    const requestData = {
      data: [
        {
          "path": "https://github.com/gradio-app/gradio/raw/main/test/test_files/audio_sample.wav",
          "meta": {"_type": "gradio.FileData"}
        },
        "Hello world!", // ref_text
        "I love programming!", // gen_text  
        true // remove_silence
      ]
    };
    
    console.log('测试API调用，使用官方示例音频');
    
    // 第一步：提交请求获取event_id
    const submitResponse = await fetch(`${HF_SPACE_URL}/gradio_api/call/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(HF_TOKEN && { 'Authorization': `Bearer ${HF_TOKEN}` })
      },
      body: JSON.stringify(requestData)
    });
    
    if (!submitResponse.ok) {
      return NextResponse.json({
        error: '提交失败',
        status: submitResponse.status,
        statusText: submitResponse.statusText
      }, { status: submitResponse.status });
    }
    
    const submitResult = await submitResponse.json();
    const eventId = submitResult.event_id;
    
    if (!eventId) {
      return NextResponse.json({
        error: '未获得event_id',
        data: submitResult
      }, { status: 500 });
    }
    
    console.log('获得event_id:', eventId);
    
    // 第二步：轮询结果
    const eventUrl = `${HF_SPACE_URL}/gradio_api/call/predict/${eventId}`;
    const maxRetries = 30;
    
    for (let i = 0; i < maxRetries; i++) {
      console.log(`轮询 ${i + 1}/${maxRetries}`);
      
      const eventResponse = await fetch(eventUrl, {
        method: 'GET',
        headers: {
          ...(HF_TOKEN && { 'Authorization': `Bearer ${HF_TOKEN}` })
        }
      });
      
      if (!eventResponse.ok) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      const eventData = await eventResponse.text();
      console.log('事件数据:', eventData.substring(0, 200));
      
      // 检查是否有错误
      if (eventData.includes('event: error')) {
        return NextResponse.json({
          error: '处理失败',
          eventData: eventData
        }, { status: 500 });
      }
      
      // 检查是否完成
      if (eventData.includes('event: complete')) {
        const lines = eventData.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataContent = line.replace('data: ', '').trim();
            if (dataContent && dataContent !== 'null') {
              try {
                const result = JSON.parse(dataContent);
                return NextResponse.json({
                  success: true,
                  result: result
                });
              } catch (e) {
                console.error('解析失败:', e);
              }
            }
          }
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return NextResponse.json({
      error: '超时',
      eventId: eventId
    }, { status: 408 });
    
  } catch (error) {
    console.error('测试API错误:', error);
    return NextResponse.json({
      error: '内部错误',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}