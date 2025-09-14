import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// 内存存储（生产环境应使用Redis或数据库）
const audioStore = new Map<string, { data: string; timestamp: number }>();

// 清理过期数据（5分钟后过期）
const cleanupExpired = () => {
  const now = Date.now();
  for (const [id, item] of audioStore.entries()) {
    if (now - item.timestamp > 5 * 60 * 1000) {
      audioStore.delete(id);
    }
  }
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  cleanupExpired();
  const { id } = await context.params;
  
  const audioData = audioStore.get(id);
  
  if (!audioData) {
    return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
  }
  
  // 将base64转换为Buffer
  const buffer = Buffer.from(audioData.data, 'base64');
  
  // 返回WAV音频
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=300',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    cleanupExpired();
    
    const { audioBase64 } = await request.json();
    
    if (!audioBase64) {
      return NextResponse.json({ error: 'No audio data provided' }, { status: 400 });
    }
    
    // 生成唯一ID
    const id = crypto.randomBytes(16).toString('hex');
    
    // 存储音频数据
    audioStore.set(id, {
      data: audioBase64,
      timestamp: Date.now()
    });
    
    // 构建URL
    const baseUrl = request.headers.get('origin') || 
                    `https://${request.headers.get('host')}`;
    const audioUrl = `${baseUrl}/api/audio/${id}`;
    
    return NextResponse.json({ 
      id,
      url: audioUrl,
      expiresIn: '5 minutes'
    });
  } catch (error) {
    console.error('音频存储错误:', error);
    return NextResponse.json(
      { error: '存储音频失败' },
      { status: 500 }
    );
  }
}