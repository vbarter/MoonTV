/* eslint-disable no-console */

/**
 * 环境变量验证工具
 * 用于在应用启动时检查关键环境变量是否配置正确
 */

interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 验证环境变量配置
 * @returns 验证结果
 */
export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('=== 开始环境变量验证 ===');

  // 获取存储类型
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  console.log('当前存储类型:', storageType);

  // 验证存储相关环境变量
  switch (storageType) {
    case 'upstash':
      validateUpstashConfig(errors, warnings);
      break;
    case 'redis':
      validateRedisConfig(errors, warnings);
      break;
    case 'd1':
      validateD1Config(errors, warnings);
      break;
    case 'localstorage':
      console.log('使用本地存储，跳过数据库环境变量检查');
      break;
    default:
      warnings.push(`未知的存储类型: ${storageType}`);
  }

  // 验证通用环境变量
  validateCommonConfig(errors, warnings);

  // 输出验证结果
  if (errors.length > 0) {
    console.error('=== 环境变量验证失败 ===');
    errors.forEach((error) => console.error('❌', error));
  }

  if (warnings.length > 0) {
    console.warn('=== 环境变量警告 ===');
    warnings.forEach((warning) => console.warn('⚠️', warning));
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ 环境变量验证通过');
  }

  console.log('=== 环境变量验证结束 ===');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证Upstash配置
 */
function validateUpstashConfig(errors: string[], warnings: string[]): void {
  const upstashUrl = process.env.UPSTASH_URL;
  const upstashToken = process.env.UPSTASH_TOKEN;

  if (!upstashUrl) {
    errors.push('缺少必需的环境变量: UPSTASH_URL');
  } else {
    console.log('✅ UPSTASH_URL 已配置');
    if (!upstashUrl.startsWith('https://')) {
      warnings.push('UPSTASH_URL 应该以 https:// 开头');
    }
  }

  if (!upstashToken) {
    errors.push('缺少必需的环境变量: UPSTASH_TOKEN');
  } else {
    console.log('✅ UPSTASH_TOKEN 已配置');
    if (upstashToken.length < 10) {
      warnings.push('UPSTASH_TOKEN 长度可能不正确');
    }
  }
}

/**
 * 验证Redis配置
 */
function validateRedisConfig(errors: string[], warnings: string[]): void {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    errors.push('缺少必需的环境变量: REDIS_URL');
  } else {
    console.log('✅ REDIS_URL 已配置');
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      warnings.push('REDIS_URL 应该以 redis:// 或 rediss:// 开头');
    }
  }
}

/**
 * 验证D1配置
 */
function validateD1Config(errors: string[], _warnings: string[]): void {
  const d1DatabaseId = process.env.D1_DATABASE_ID;

  if (!d1DatabaseId) {
    errors.push('缺少必需的环境变量: D1_DATABASE_ID');
  } else {
    console.log('✅ D1_DATABASE_ID 已配置');
  }
}

/**
 * 验证通用配置
 */
function validateCommonConfig(errors: string[], warnings: string[]): void {
  // 验证管理员配置
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  if (!username) {
    warnings.push('建议设置环境变量: USERNAME (管理员用户名)');
  } else {
    console.log('✅ USERNAME 已配置');
  }

  if (!password) {
    warnings.push('建议设置环境变量: PASSWORD (管理员密码)');
  } else {
    console.log('✅ PASSWORD 已配置');
    if (password.length < 6) {
      warnings.push('PASSWORD 长度建议至少6位');
    }
  }

  // 验证注册配置
  const allowRegister = process.env.NEXT_PUBLIC_ENABLE_REGISTER;
  if (allowRegister === 'true') {
    console.log('✅ 用户注册功能已启用');

    // 如果启用注册，建议检查存储配置
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE;
    if (storageType === 'localstorage') {
      warnings.push('启用注册功能时建议使用数据库存储而非本地存储');
    }
  }

  // 验证站点配置
  const siteName = process.env.SITE_NAME;
  if (!siteName) {
    warnings.push('建议设置环境变量: SITE_NAME (站点名称)');
  }
}

/**
 * 在Cloudflare环境中的特殊验证
 */
export function validateCloudflareEnvironment(): void {
  console.log('=== Cloudflare环境检查 ===');

  // 检查是否在Cloudflare Workers环境中
  const isCloudflare =
    typeof globalThis.caches !== 'undefined' &&
    typeof (globalThis as Record<string, unknown>)
      .CloudflareWorkersGlobalScope !== 'undefined';

  if (isCloudflare) {
    console.log('✅ 检测到Cloudflare Workers环境');

    // Cloudflare特定的环境变量检查
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE;
    if (storageType === 'redis') {
      console.warn(
        '⚠️ Cloudflare Workers可能无法直接连接到Redis，建议使用Upstash'
      );
    }
  } else {
    console.log('ℹ️ 非Cloudflare Workers环境');
  }
}

/**
 * 获取环境信息摘要
 */
export function getEnvironmentSummary(): Record<string, unknown> {
  return {
    storageType: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage',
    enableRegister: process.env.NEXT_PUBLIC_ENABLE_REGISTER === 'true',
    siteName: process.env.SITE_NAME || 'MoonTV',
    hasUsername: !!process.env.USERNAME,
    hasPassword: !!process.env.PASSWORD,
    hasUpstashUrl: !!process.env.UPSTASH_URL,
    hasUpstashToken: !!process.env.UPSTASH_TOKEN,
    hasRedisUrl: !!process.env.REDIS_URL,
    hasD1DatabaseId: !!process.env.D1_DATABASE_ID,
    nodeEnv: process.env.NODE_ENV,
    dockerEnv: process.env.DOCKER_ENV === 'true',
  };
}
