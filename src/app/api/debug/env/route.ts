/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';

import {
  getEnvironmentSummary,
  validateCloudflareEnvironment,
  validateEnvironment,
} from '@/lib/env-validation';

export const runtime = 'edge';

/**
 * 环境配置调试端点
 * 注意：这个端点应该只在开发或调试时使用，生产环境应该禁用
 */
export async function GET(req: NextRequest) {
  // 安全检查：只允许在特定条件下访问
  const isDevelopment = process.env.NODE_ENV === 'development';
  const debugKey = process.env.DEBUG_KEY;
  const providedKey = req.nextUrl.searchParams.get('key');

  if (!isDevelopment && (!debugKey || debugKey !== providedKey)) {
    return NextResponse.json({ error: '访问被拒绝' }, { status: 403 });
  }

  console.log('=== 环境配置调试请求 ===');

  try {
    // 执行环境验证
    const validation = validateEnvironment();

    // 执行Cloudflare环境检查
    validateCloudflareEnvironment();

    // 获取环境摘要
    const summary = getEnvironmentSummary();

    // 检查Upstash连接
    let upstashStatus = 'unknown';
    if (summary.storageType === 'upstash') {
      try {
        // 尝试创建Upstash客户端来测试连接
        const { UpstashRedisStorage } = await import('@/lib/upstash.db');
        const storage = new UpstashRedisStorage();

        // 尝试执行一个简单的操作
        await storage.checkUserExist('__test_user__');
        upstashStatus = 'connected';
      } catch (error: any) {
        upstashStatus = `connection_failed: ${error.message}`;
      }
    }

    const response = {
      timestamp: new Date().toISOString(),
      validation: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
      },
      environment: {
        ...summary,
        upstashStatus,
      },
      headers: {
        userAgent: req.headers.get('user-agent'),
        cfRay: req.headers.get('cf-ray'), // Cloudflare的请求ID
        cfConnectingIp: req.headers.get('cf-connecting-ip'),
        xForwardedFor: req.headers.get('x-forwarded-for'),
      },
      cloudflareDetection: {
        hasCaches: typeof globalThis.caches !== 'undefined',
        hasCloudflareGlobal:
          typeof globalThis.CloudflareWorkersGlobalScope !== 'undefined',
        cfRayHeader: !!req.headers.get('cf-ray'),
      },
    };

    console.log('环境调试信息:', response);

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('环境调试检查失败:', error);

    return NextResponse.json(
      {
        error: '环境检查失败',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
