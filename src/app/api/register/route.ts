/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import {
  getEnvironmentSummary,
  validateEnvironment,
} from '@/lib/env-validation';

export const runtime = 'edge';

// 读取存储类型环境变量，默认 localstorage
const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'd1'
    | undefined) || 'localstorage';

// 生成签名
async function generateSignature(
  data: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  // 导入密钥
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // 生成签名
  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  // 转换为十六进制字符串
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 生成认证Cookie（带签名）
async function generateAuthCookie(username: string): Promise<string> {
  const authData: any = {
    username,
    timestamp: Date.now(),
  };

  // 使用process.env.PASSWORD作为签名密钥，而不是用户密码
  const signingKey = process.env.PASSWORD || '';
  const signature = await generateSignature(username, signingKey);
  authData.signature = signature;

  return encodeURIComponent(JSON.stringify(authData));
}

export async function POST(req: NextRequest) {
  console.log('=== 用户注册请求开始 ===');
  console.log('存储类型:', STORAGE_TYPE);

  // 环境验证
  const envValidation = validateEnvironment();
  console.log('环境信息摘要:', getEnvironmentSummary());

  if (!envValidation.valid) {
    console.error('环境变量验证失败，无法继续注册');
    return NextResponse.json(
      {
        error: '服务器配置错误',
        details: envValidation.errors,
      },
      { status: 500 }
    );
  }

  try {
    // localstorage 模式下不支持注册
    if (STORAGE_TYPE === 'localstorage') {
      console.log('注册失败: 当前模式不支持注册');
      return NextResponse.json(
        { error: '当前模式不支持注册' },
        { status: 400 }
      );
    }

    console.log('开始获取系统配置...');
    const config = await getConfig();
    console.log(
      '系统配置获取成功, 注册开放状态:',
      config.UserConfig.AllowRegister
    );

    // 校验是否开放注册
    if (!config.UserConfig.AllowRegister) {
      console.log('注册失败: 当前未开放注册');
      return NextResponse.json({ error: '当前未开放注册' }, { status: 400 });
    }

    console.log('开始解析请求体...');
    const { username, password } = await req.json();
    console.log(
      '请求解析成功, 用户名:',
      username,
      '密码长度:',
      password?.length
    );

    if (!username || typeof username !== 'string') {
      console.log('注册失败: 用户名无效');
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      console.log('注册失败: 密码无效');
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    // 检查是否和管理员重复
    if (username === process.env.USERNAME) {
      console.log('注册失败: 用户名与管理员重复');
      return NextResponse.json({ error: '用户已存在' }, { status: 400 });
    }

    try {
      console.log('开始检查用户是否已存在...');
      // 检查用户是否已存在
      const exist = await db.checkUserExist(username);
      console.log('用户存在检查结果:', exist);

      if (exist) {
        console.log('注册失败: 用户已存在');
        return NextResponse.json({ error: '用户已存在' }, { status: 400 });
      }

      console.log('开始注册用户到数据库...');
      await db.registerUser(username, password);
      console.log('用户注册到数据库成功');

      console.log('开始更新系统配置...');
      // 添加到配置中并保存
      config.UserConfig.Users.push({
        username,
        role: 'user',
      });
      await db.saveAdminConfig(config);
      console.log('系统配置更新成功');

      console.log('开始生成认证Cookie...');
      // 注册成功，设置认证cookie
      const response = NextResponse.json({ ok: true });
      const cookieValue = await generateAuthCookie(username);
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // 7天过期

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax', // 改为 lax 以支持 PWA
        httpOnly: false, // PWA 需要客户端可访问
        secure: false, // 根据协议自动设置
      });

      console.log('用户注册完全成功, 用户名:', username);
      console.log('=== 用户注册请求结束 ===');
      return response;
    } catch (err: any) {
      console.error('=== 数据库操作失败 ===');
      console.error('错误类型:', err.constructor.name);
      console.error('错误信息:', err.message);
      console.error('错误堆栈:', err.stack);
      console.error('完整错误对象:', err);

      // 根据错误类型提供更具体的错误信息
      let errorMessage = '数据库错误';
      if (err.message?.includes('UPSTASH') || err.message?.includes('Redis')) {
        errorMessage = 'Upstash Redis连接失败，请检查环境变量配置';
      } else if (err.message?.includes('环境变量')) {
        errorMessage = err.message;
      } else if (
        err.message?.includes('Connection') ||
        err.message?.includes('ECONNREFUSED')
      ) {
        errorMessage = '数据库连接失败，请稍后重试';
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error: any) {
    console.error('=== 注册接口顶级异常 ===');
    console.error('错误类型:', error.constructor.name);
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    console.error('完整错误对象:', error);
    console.error('=== 注册接口异常结束 ===');

    // 根据错误类型提供更具体的错误信息
    let errorMessage = '服务器错误';
    if (error.message?.includes('JSON')) {
      errorMessage = '请求格式错误';
    } else if (
      error.message?.includes('UPSTASH') ||
      error.message?.includes('环境变量')
    ) {
      errorMessage = 'Upstash配置错误，请检查环境变量';
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
