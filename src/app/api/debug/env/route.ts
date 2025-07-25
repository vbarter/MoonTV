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

    // 检查数据库连接状态（简化版本，避免动态导入问题）
    let dbStatus = 'unknown';
    if (summary.storageType !== 'localstorage') {
      // 暂时跳过实际连接测试，避免构建时的导入问题
      // 实际部署时，可以通过日志查看连接状态
      dbStatus = 'config_check_only';
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
        dbStatus,
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
          typeof (globalThis as Record<string, unknown>)
            .CloudflareWorkersGlobalScope !== 'undefined',
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
  } catch (error) {
    console.error('环境调试检查失败:', error);

    return NextResponse.json(
      {
        error: '环境检查失败',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
