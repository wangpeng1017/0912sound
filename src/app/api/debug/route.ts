import { NextResponse } from 'next/server';

export async function GET() {
  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    NEXT_PUBLIC_HF_SPACE_URL: process.env.NEXT_PUBLIC_HF_SPACE_URL,
    NEXT_PUBLIC_HF_API_NAME: process.env.NEXT_PUBLIC_HF_API_NAME,
    HF_TOKEN: process.env.HF_TOKEN ? `${process.env.HF_TOKEN.substring(0, 10)}...` : 'undefined',
    // 添加所有环境变量的键名（不显示值）
    allKeys: Object.keys(process.env).filter(key => key.includes('HF') || key.includes('NEXT_PUBLIC'))
  };

  console.log('环境变量调试:', envVars);

  return NextResponse.json({
    message: '环境变量调试信息',
    environment: envVars,
    timestamp: new Date().toISOString()
  });
}
