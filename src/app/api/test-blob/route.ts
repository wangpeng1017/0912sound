import { NextRequest, NextResponse } from 'next/server';

// 测试Vercel Blob Storage的URL是否能被F5-TTS访问
export async function GET(_request: NextRequest) {
  try {
    const HF_SPACE_URL = process.env.NEXT_PUBLIC_HF_SPACE_URL || 'https://wangpe-2e2-f5-tts.hf.space';
    const HF_TOKEN = process.env.HF_TOKEN;
    
    // 使用刚才成功上传的Vercel Blob URL进行测试
    const testUrl = 'https://aul5hsnqwn21br8h.public.blob.vercel-storage.com/audio-1757862042831.wav';
    
    console.log('测试Vercel Blob Storage URL:', testUrl);
    
    // 首先验证URL是否可访问
    const checkResponse = await fetch(testUrl, { method: 'HEAD' });
    if (!checkResponse.ok) {
      return NextResponse.json({
        error: 'Blob URL无法访问',
        status: checkResponse.status
      }, { status: 400 });
    }
    
    console.log('Blob URL可访问，测试F5-TTS...');
    
    const requestData = {
      data: [
        {
          "path": testUrl,
          "orig_name": "test_audio.wav",
          "mime_type": "audio/wav",
          "size": null,
          "is_stream": false,
          "meta": {"_type": "gradio.FileData"}
        },
        "Test text",
        "Hello world from Vercel Blob!",
        true
      ]
    };
    
    // 调用F5-TTS
    const response = await fetch(`${HF_SPACE_URL}/gradio_api/call/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(HF_TOKEN && { 'Authorization': `Bearer ${HF_TOKEN}` })
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({
        error: 'F5-TTS调用失败',
        status: response.status,
        details: error
      }, { status: response.status });
    }
    
    const result = await response.json();
    const eventId = result.event_id;
    
    if (!eventId) {
      return NextResponse.json({
        error: '未获得event_id',
        result
      }, { status: 500 });
    }
    
    console.log('获得event_id:', eventId);
    
    // 轮询一次看结果
    const eventUrl = `${HF_SPACE_URL}/gradio_api/call/predict/${eventId}`;
    const eventResponse = await fetch(eventUrl, {
      headers: {
        ...(HF_TOKEN && { 'Authorization': `Bearer ${HF_TOKEN}` })
      }
    });
    
    const eventData = await eventResponse.text();
    
    // 分析响应
    let status = 'unknown';
    let message = '';
    
    if (eventData.includes('event: error')) {
      status = 'error';
      const match = eventData.match(/data: "?([^"\n]+)"?/);
      message = match ? match[1] : '未知错误';
    } else if (eventData.includes('event: heartbeat')) {
      status = 'processing';
      message = '正在处理中...';
    } else if (eventData.includes('event: complete')) {
      status = 'success';
      message = '处理完成！';
    }
    
    return NextResponse.json({
      success: status !== 'error',
      status,
      message,
      eventId,
      testUrl,
      eventData: eventData.substring(0, 500)
    });
    
  } catch (error) {
    console.error('测试错误:', error);
    return NextResponse.json({
      error: '测试失败',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}