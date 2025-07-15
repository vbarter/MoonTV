// API 配置文件
// 在 Tauri 模式下，API 调用会指向远程服务器
// 在正常模式下，API 调用指向本地

export const getApiBaseUrl = (): string => {
  // 检查是否在 Tauri 环境中
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    // Tauri 环境下使用远程服务器
    // 优先使用环境变量，如果没有则使用默认值
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://your-server.com';
  }

  // 浏览器环境下使用相对路径
  return '';
};

export const getApiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${path}`;
};

// 检查是否在 Tauri 环境中
export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && (window as any).__TAURI__;
};

// 获取完整的 API 配置信息
export const getApiConfig = () => {
  return {
    baseUrl: getApiBaseUrl(),
    isTauri: isTauriEnvironment(),
    // 可以添加更多配置项
  };
};
